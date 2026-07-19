import Stripe from "stripe";

// apiVersion pinned to the version shipped as the `stripe` package's
// `LatestApiVersion` type (see node_modules/stripe/cjs/apiVersion.d.ts).
//
// Unlike lib/supabase/admin.ts, an empty-string fallback here is NOT safe:
// Stripe's constructor treats a falsy apiKey as missing and throws
// synchronously ("Neither apiKey nor config.authenticator provided"), which
// would crash `next build`'s page-data collection for every route that
// imports this module. A non-empty placeholder avoids that throw; any real
// API call made with it will fail at request time with a normal Stripe auth
// error (401), which is the "fail gracefully at request time" behavior we want.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_not_configured", {
  apiVersion: "2026-06-24.dahlia",
});

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_PRO);
}
