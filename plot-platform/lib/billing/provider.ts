import "server-only";

import { serverEnv } from "@/lib/env/server";

/** Provider-agnostic billing interface (§9, Razorpay behind an adapter per
 * the architecture table) — kept deliberately small: checkout + webhook
 * verification are the only operations the app needs from a payment
 * provider, everything else (plans, limits, usage) lives in our own DB. */
export interface BillingProvider {
  createSubscriptionCheckout(args: {
    orgId: string;
    planCode: string;
    returnUrl: string;
  }): Promise<{ checkoutUrl: string } | { error: string }>;
}

/**
 * No RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are configured in this
 * environment, so this returns null rather than a fake checkout URL (rule
 * 2). A real adapter (Razorpay Subscriptions API) plugs in here behind the
 * same interface once keys exist — nothing else in the app needs to change.
 */
export function getBillingProvider(): BillingProvider | null {
  const env = serverEnv();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;
  return null;
}
