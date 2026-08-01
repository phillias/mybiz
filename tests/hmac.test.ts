import { describe, expect, it } from "vitest";
import { hmacSha256 } from "../convex/lib/hmac";

// RFC 4231 test vector 1: HMAC-SHA256("key", "The quick brown fox...")
const RFC4231_VECTOR =
  "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";

describe("hmacSha256", () => {
  it("matches the RFC 4231 known vector", async () => {
    const digest = await hmacSha256("key", "The quick brown fox jumps over the lazy dog");
    expect(digest).toBe(RFC4231_VECTOR);
  });

  it("is deterministic for the same input", async () => {
    const a = await hmacSha256("secret", "payload");
    const b = await hmacSha256("secret", "payload");
    expect(a).toBe(b);
  });

  it("differs when the secret changes (signature tamper detection)", async () => {
    const a = await hmacSha256("secret-a", "payload");
    const b = await hmacSha256("secret-b", "payload");
    expect(a).not.toBe(b);
  });

  it("differs when the payload changes (payload tamper detection)", async () => {
    const a = await hmacSha256("secret", "payload");
    const b = await hmacSha256("secret", "payload-x");
    expect(a).not.toBe(b);
  });
});
