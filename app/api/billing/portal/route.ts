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
    .select("stripe_customer_id")
    .eq("id", orgId)
    .single();

  if (error || !org) {
    return NextResponse.json({ error: error?.message ?? "Organization not found" }, { status: 500 });
  }

  if (!org.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account yet" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${origin}/dashboard/settings`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("[billing/portal] Stripe error:", err);
    return NextResponse.json(
      { error: "Couldn't open the billing portal right now — try again shortly." },
      { status: 502 },
    );
  }
}
