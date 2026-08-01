import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { hmacSha256 } from "./lib/hmac";

const http = httpRouter();

/** OPTIONS preflight for cross-origin browser calls (Cloudflare Pages → Convex). */
http.route({
  pathPrefix: "/",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => new Response(null, { status: 204, headers: corsHeaders(request) })),
});

/**
 * U1: Cloudflare Turnstile server-side verification.
 * Frontend posts { token } to `${CONVEX_URL}/turnstile/verify`.
 * Returns 200 {success:true} or 400 with error codes.
 */
http.route({
  path: "/turnstile/verify",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const secret = process.env.TURNSTILE_SECRET;
    if (!secret) {
      return json(400, { success: false, error: "TURNSTILE_SECRET not set" }, request);
    }
    let token: string;
    try {
      ({ token } = await request.json());
    } catch {
      return json(400, { success: false, error: "invalid JSON body" }, request);
    }
    const remoteip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const body = new URLSearchParams({ secret, response: token });
    if (remoteip) body.set("remoteip", remoteip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    return json(data.success ? 200 : 400, {
      success: data.success,
      errors: data["error-codes"] ?? [],
    }, request);
  }),
});

/**
 * U2/U6: Telnyx inbound SMS/voice webhook → conversations table.
 * Point Mission Control → Webhooks → outbound to `${CONVEX_URL}/telnyx-webhook`.
 * HMAC-SHA256 verified against TELNYX_WEBHOOK_SECRET (Web Crypto, edge-safe).
 * TODO(U6): port to jose JWT verification if signed payloads are enabled.
 */
http.route({
  path: "/telnyx-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.TELNYX_WEBHOOK_SECRET;
    const raw = await request.text();
    if (secret) {
      const sig = request.headers.get("x-telnyx-signature") ?? "";
      const expected = await hmacSha256(secret, raw);
      if (sig !== expected) {
        return json(401, { success: false, error: "invalid signature" }, request);
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
    if (event === "message.received" && p.from) {
      await ctx.runMutation(internal.messaging.insertInboundSms, {
        phoneNumber: p.from,
        body: p.text,
        metadata: { event, messageId: p.id, to: p.to },
      });
      // TODO(U6): STOP/START keyword handling + auto-reply via Telnyx API
    }
    return json(200, { success: true }, request);
  }),
});

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
}

function json(status: number, body: unknown, request?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(request ? corsHeaders(request) : {}) },
  });
}

export default http;
