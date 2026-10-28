import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { verifyStripeEvent } from "../src/lib/stripe-webhook";

const SECRET = "whsec_test_secret_123";

// Replicate Stripe's signature scheme: HMAC-SHA256 over `${timestamp}.${payload}`,
// header `t=<ts>,v1=<hex>`, key = the raw secret (whsec_ prefix included).
function sign(payload: string, secret: string, timestamp: number): string {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("verifyStripeEvent", () => {
  it("returns the parsed event for a valid signature", async () => {
    const payload = JSON.stringify({
      id: "evt_test_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1" } },
    });
    const header = sign(payload, SECRET, Math.floor(Date.now() / 1000));
    const event: Stripe.Event = await verifyStripeEvent(payload, header, SECRET);
    expect(event.id).toBe("evt_test_1");
    expect(event.type).toBe("checkout.session.completed");
  });

  it("rejects a tampered payload (signature mismatch)", async () => {
    const payload = JSON.stringify({ id: "evt_test_2", type: "invoice.paid" });
    const header = sign(payload, SECRET, Math.floor(Date.now() / 1000));
    await expect(verifyStripeEvent(`${payload}tampered`, header, SECRET)).rejects.toMatchObject(
      { type: "StripeSignatureVerificationError" }
    );
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const payload = JSON.stringify({ id: "evt_test_3", type: "invoice.paid" });
    const header = sign(payload, "whsec_other_secret", Math.floor(Date.now() / 1000));
    await expect(verifyStripeEvent(payload, header, SECRET)).rejects.toMatchObject({
      type: "StripeSignatureVerificationError",
    });
  });

  it("rejects a malformed signature header", async () => {
    const payload = JSON.stringify({ id: "evt_test_4", type: "invoice.paid" });
    await expect(verifyStripeEvent(payload, "not-a-signature", SECRET)).rejects.toMatchObject(
      { type: "StripeSignatureVerificationError" }
    );
  });

  it("rejects a header without a v1 signature", async () => {
    const payload = JSON.stringify({ id: "evt_test_5", type: "invoice.paid" });
    const header = `t=${Math.floor(Date.now() / 1000)}`;
    await expect(verifyStripeEvent(payload, header, SECRET)).rejects.toMatchObject({
      type: "StripeSignatureVerificationError",
    });
  });

  it("rejects a timestamp outside the tolerance window", async () => {
    const payload = JSON.stringify({ id: "evt_test_6", type: "invoice.paid" });
    const header = sign(payload, SECRET, 946684800);
    await expect(verifyStripeEvent(payload, header, SECRET)).rejects.toMatchObject({
      type: "StripeSignatureVerificationError",
    });
  });

  it("throws a clear error when the signature header is missing", async () => {
    const payload = JSON.stringify({ id: "evt_test_7", type: "invoice.paid" });
    await expect(verifyStripeEvent(payload, null, SECRET)).rejects.toThrow(
      "Missing stripe-signature header"
    );
    await expect(verifyStripeEvent(payload, undefined, SECRET)).rejects.toThrow(
      "Missing stripe-signature header"
    );
  });
});
