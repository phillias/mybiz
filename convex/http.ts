import { httpRouter } from "convex/server";
import { action, mutation } from "./_generated/server";

const http = httpRouter();

/**
 * U1: Cloudflare Turnstile server-side verification.
 * Frontend posts { token } to `${CONVEX_URL}/turnstile/verify`.
 * Returns 200 {success:true} or 400 with error codes.
 */
http.route({
  path: "/turnstile/verify",
  method: "POST",
  handler: action(async ({ request }) => {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      return json(400, { success: false, error: "TURNSTILE_SECRET_KEY not set" });
    }
    let token: string;
    try {
      ({ token } = await request.json());
    } catch {
      return json(400, { success: false, error: "invalid JSON body" });
    }
    const body = new URLSearchParams({ secret, response: token });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    return json(data.success ? 200 : 400, {
      success: data.success,
      errors: data["error-codes"] ?? [],
    });
  }),
});

/**
 * U2/U6: Telnyx inbound SMS/voice webhook → conversations table.
 * Point Mission Control → Webhooks → outbound to `${CONVEX_URL}/telnyx-webhook`.
 *
 * Signature verification: Telnyx signs webhooks with a JWT (RS256, their public
 * key) or an HMAC secret. This stub verifies HMAC-SHA256 (Web Crypto, edge-safe)
 * against TELNYX_WEBHOOK_SECRET; switch to JWT verification (jose) if you
 * enable "signed payloads" in Mission Control. TODO(U6): port to jose JWT.
 */
http.route({
  path: "/telnyx-webhook",
  method: "POST",
  handler: mutation(async ({ db, request }) => {
    const secret = process.env.TELNYX_WEBHOOK_SECRET;
    const raw = await request.text();
    if (secret) {
      const sig = request.headers.get("x-telnyx-signature") ?? "";
      const expected = await hmacSha256(secret, raw);
      if (sig !== expected) {
        return json(401, { success: false, error: "invalid signature" });
      }
    }
    const payload = JSON.parse(raw) as {
      data?: {
        event_type?: string;
        payload?: {
          to?: string;
          from?: string;
          text?: string;
          direction?: string;
          id?: string;
        };
      };
    };
    const event = payload.data?.event_type ?? "";
    const p = payload.data?.payload ?? {};
    // inbound SMS events only; voice events arrive as call.* events (U6 wires them)
    if (event === "message.received" && p.from) {
      await db.insert("conversations", {
        phoneNumber: p.from,
        direction: "inbound",
        channel: "sms",
        body: p.text,
        optedOut: false,
        metadata: { event, messageId: p.id, to: p.to },
      });
      // TODO(U6): STOP/START keyword handling + auto-reply via Telnyx API
    }
    return json(200, { success: true });
  }),
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** HMAC-SHA256 via Web Crypto — safe on Convex's edge runtime. */
async function hmacSha256(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default http;
