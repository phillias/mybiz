import { describe, expect, it } from "vitest";
import { b64FromBytes, verifyTelnyxSignature } from "../convex/lib/ed25519";

const MESSAGE = `1722540000|{"data":{"event_type":"message.received","payload":{"from":"+15551234567"}}}`;

async function keypair(): Promise<{ pubB64: string; priv: CryptoKey }> {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  );
  const raw = await crypto.subtle.exportKey("raw", publicKey);
  return { pubB64: b64FromBytes(new Uint8Array(raw)), priv: privateKey };
}

async function sign(priv: CryptoKey, message: string): Promise<string> {
  const sig = await crypto.subtle.sign("Ed25519", priv, new TextEncoder().encode(message));
  return b64FromBytes(new Uint8Array(sig));
}

describe("verifyTelnyxSignature", () => {
  it("accepts a valid signature over timestamp|payload", async () => {
    const { pubB64, priv } = await keypair();
    const sig = await sign(priv, MESSAGE);
    expect(await verifyTelnyxSignature(pubB64, sig, MESSAGE)).toBe(true);
  });

  it("rejects a tampered payload (message changed after signing)", async () => {
    const { pubB64, priv } = await keypair();
    const sig = await sign(priv, MESSAGE);
    expect(await verifyTelnyxSignature(pubB64, sig, `${MESSAGE}x`)).toBe(false);
  });

  it("rejects a signature from a different key", async () => {
    const a = await keypair();
    const b = await keypair();
    const sig = await sign(a.priv, MESSAGE);
    expect(await verifyTelnyxSignature(b.pubB64, sig, MESSAGE)).toBe(false);
  });
});
