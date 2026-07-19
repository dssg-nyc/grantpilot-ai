import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

// No auth middleware here — Stripe calls this endpoint directly and the only
// verification is the `stripe-signature` header checked via constructEvent below.

const CANCELED_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

async function findOrgIdBySubscription(subscriptionId: string | null, customerId: string | null) {
  if (subscriptionId) {
    const { data } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  if (customerId) {
    const { data } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Any Supabase write failure below returns 5xx (instead of swallowing the
  // error and returning 200) so Stripe's automatic retry logic re-delivers
  // the event. All writes are plain `update`s keyed by org id / customer id
  // / subscription id, so replaying the same event is safe (idempotent).
  let persistError: string | null = null;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.org_id;
      if (orgId) {
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        const { error } = await supabaseAdmin
          .from("organizations")
          .update({
            plan: "pro",
            plan_status: "active",
            ...(customerId ? { stripe_customer_id: customerId } : {}),
            ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
          })
          .eq("id", orgId);
        if (error) persistError = error.message;
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;
      const orgId = await findOrgIdBySubscription(subscription.id, customerId);

      if (orgId) {
        const periodEndUnix = subscription.items?.data?.[0]?.current_period_end;
        const planStatus = subscription.status;
        const { error } = await supabaseAdmin
          .from("organizations")
          .update({
            plan: CANCELED_STATUSES.has(planStatus) ? "free" : "pro",
            plan_status: planStatus,
            ...(periodEndUnix
              ? { plan_current_period_end: new Date(periodEndUnix * 1000).toISOString() }
              : {}),
          })
          .eq("id", orgId);
        if (error) persistError = error.message;
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;
      const orgId = await findOrgIdBySubscription(subscription.id, customerId);

      if (orgId) {
        const { error } = await supabaseAdmin
          .from("organizations")
          .update({ plan: "free", plan_status: "canceled" })
          .eq("id", orgId);
        if (error) persistError = error.message;
      }
      break;
    }

    default:
      break;
  }

  if (persistError) {
    console.error("[webhooks/stripe] failed to persist event", event.id, event.type, persistError);
    return NextResponse.json({ error: "Failed to persist billing state" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
