// Stripe webhook signature verification — shared helper for the upcoming
// /api/stripe/webhook route (route wiring tracked in phillias/mybiz#67).
// Uses constructEventAsync (Web-runtime compatible — no Node-only sync
// crypto path) to verify HMAC-SHA256 over `${timestamp}.${payload}`.
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "whsec_placeholder");

/**
 * Verify a Stripe webhook signature and parse the raw request body into an event.
 * Throws a plain Error when the signature header is absent and a
 * StripeSignatureVerificationError (err.type) for bad/malformed signatures.
 */
export async function verifyStripeEvent(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string
): Promise<Stripe.Event> {
  if (!signatureHeader) {
    throw new Error("Missing stripe-signature header");
  }
  return stripe.webhooks.constructEventAsync(rawBody, signatureHeader, secret);
}
