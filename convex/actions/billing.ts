"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

/**
 * Harbor's public plans (EUR) — plan U1 requirement "Stripe test mode with
 * €-denominated subscription plans (Solo/Growth/Powerhouse shapes)".
 * Mirrors harborseo.ai published pricing. Monthly billing only
 * (founder annual lock rejected — see decision memory d-2026-07-31).
 */
export const PLANS = [
  { id: "solo", name: "Solo", priceEur: 24, articlesPerMonth: 25 },
  { id: "growth", name: "Growth", priceEur: 39, articlesPerMonth: 50 },
  { id: "powerhouse", name: "Powerhouse", priceEur: 83, articlesPerMonth: 100 },
] as const;

/**
 * Create a Stripe Checkout Session (test mode). Stub — wire success_url
 * back to the app and add the Stripe webhook handler (checkout.session.completed)
 * in U7/follow-up. Requires STRIPE_SECRET_KEY + a Price ID per plan.
 */
export const createCheckoutSession = action({
  args: {
    planId: v.union(v.literal("solo"), v.literal("growth"), v.literal("powerhouse")),
    customerEmail: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.log("[billing:stub]", { planId: args.planId, customerEmail: args.customerEmail });
      return { url: null, reason: "STRIPE_SECRET_KEY not set" };
    }
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);
    const plan = PLANS.find((p) => p.id === args.planId);
    if (!plan) throw new Error(`unknown plan ${args.planId}`);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: args.customerEmail,
      line_items: [
        // TODO: replace with real Price IDs from the Stripe dashboard:
        // { price: "price_...", quantity: 1 }
        { price_data: { currency: "eur", unit_amount: plan.priceEur * 100, recurring: { interval: "month" }, product_data: { name: plan.name } }, quantity: 1 },
      ],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: { planId: plan.id },
    });
    return { url: session.url };
  },
});
