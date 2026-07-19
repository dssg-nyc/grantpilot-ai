import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe, isStripeConfigured } from "@/lib/stripe/client";

async function getOrgId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("org_id").eq("id", user.id).single();
  return data?.org_id ?? null;
}

export async function POST(request: Request) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized or no org" }, { status: 401 });

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing isn't set up yet — check back soon." },
      { status: 503 },
    );
  }

  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .select("plan, stripe_customer_id, legal_name")
    .eq("id", orgId)
    .single();

  if (error || !org) {
    return NextResponse.json({ error: error?.message ?? "Organization not found" }, { status: 500 });
  }

  if (org.plan === "pro") {
    return NextResponse.json({ error: "Already on the Pro plan" }, { status: 400 });
  }

  let customerId = org.stripe_customer_id as string | null;

  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.legal_name ?? undefined,
        metadata: { org_id: orgId },
      });
      customerId = customer.id;

      const { error: updateError } = await supabaseAdmin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", orgId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID_PRO, quantity: 1 }],
      success_url: `${origin}/dashboard/settings?upgraded=1`,
      cancel_url: `${origin}/dashboard/settings`,
      metadata: { org_id: orgId },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("[billing/checkout] Stripe error:", err);
    return NextResponse.json(
      { error: "Couldn't start checkout right now — try again shortly." },
      { status: 502 },
    );
  }
}
