/**
 * Harbor Voice — "The Aftercall": post-service voice + SMS review-request flow.
 *
 * v1 = Telnyx-native (plan docs/plans/2026-08-16-002-vapi-review-outreach.md, Option A).
 * Trigger → scheduleAftercall (mutation) → computes the review-link rotation slot
 * (GBP → Yelp → Angi) → schedules startOutboundCall (action) → POST /v2/calls on
 * the owned voice connection. The agent prompt + `send_message` link delivery are
 * configured in the Telnyx portal (AFTERCALL_PROMPT below); the call-control and
 * messaging webhooks already land on `/telnyx-webhook` (convex/http.ts), which
 * shares the Ed25519 verifier.
 *
 * Why this file lives at the convex/ root and NOT in convex/actions/:
 * `actions/` is a legacy folder that forces `"use node"`, and the Node runtime is
 * restricted to action functions only. This module mixes a mutation, an internal
 * mutation, a query and an action, so it must run in the default Convex runtime —
 * which fully supports fetch, process.env and crypto (same as convex/http.ts).
 *
 * Safety contract (defaults are cheap on purpose):
 *  - `scheduleAftercall` guards conversations.optedOut and NEVER places a call
 *    unless `dryRun: false` is passed explicitly.
 *  - `startOutboundCall` defaults to `dryRun: true` (logs the would-be payload).
 *    Even with dryRun:false it stubs (logs, returns) when TELNYX_API_KEY /
 *    TELNYX_NUMBER / PUBLIC_CONVEX_URL are missing — it never fails a pipeline
 *    outside prod and never spends Telnyx minutes by accident.
 */

import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import type { DatabaseReader } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/** Voice connection for the owned toll-free number (Mission Control → Connections). */
export const TELNYX_CONNECTION_ID = "3016892976782640902";
export const TELNYX_CALLS_ENDPOINT = "https://api.telnyx.com/v2/calls";

/** Review platform rotation order (GBP → Yelp → Angi per plan §2). */
export const PLATFORMS = ["google", "yelp", "angi"] as const;
export type ReviewPlatform = (typeof PLATFORMS)[number];

/** Review recency window: the call happens 24-48h after the job closes. */
export const REVIEW_WINDOW = {
  startHours: 24,
  endHours: 48,
  label: "24-48h after service",
} as const;

export type ReviewLinkParams = {
  /** Platform-specific business identifier: Google Place ID, Yelp biz slug, Angi company slug. */
  place?: string;
  service?: string;
  city?: string;
};

/**
 * Direct review-link builders. Per-plan rotation spreads reviews across Google,
 * Yelp and Angi so the AI-citation layer reads more than GBP alone.
 *
 * - google: `place` = Google Place ID (ChIJ…). Confirmed format:
 *   https://search.google.com/local/writereview?placeid=<id>
 * - yelp: `place` = Yelp biz slug (from yelp.com/biz/<slug>). Confirmed format.
 * - angi: `place` = Angi company slug (angi.com/company/<slug>). TODO: confirm the
 *   direct review-write path for Angi (their CTA flow may need the /reviews tab).
 *
 * When the per-business identifier is not configured yet, fall back to a search
 * URL so v1 still ships a clickable link; replace with the direct link once the
 * identifiers are configured.
 */
export const REVIEW_LINK_TEMPLATES = {
  google: ({ place, service, city }: ReviewLinkParams): string =>
    place
      ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(place)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [service, city].filter(Boolean).join(", "),
        )}`,
  yelp: ({ place, service, city }: ReviewLinkParams): string =>
    place
      ? `https://www.yelp.com/biz/${encodeURIComponent(place)}`
      : `https://www.yelp.com/search?find_desc=${encodeURIComponent(service ?? "")}&find_loc=${encodeURIComponent(city ?? "")}`,
  angi: ({ place }: ReviewLinkParams): string =>
    place
      ? `https://www.angi.com/company/${encodeURIComponent(place)}`
      : "https://www.angi.com/", // TODO: confirm Angi search/review-write URL shape
} as const;

export function rotatePlatform(slot: number): ReviewPlatform {
  return PLATFORMS[Math.abs(slot) % PLATFORMS.length];
}

/** Build the exact POST body for Telnyx Create Call (/v2/calls). */
export type TelnyxCallPayload = {
  connection_id: string;
  to: string;
  from: string;
  client_state: string;
  webhook_url: string;
  webhook_url_method: "POST";
  command_id?: string;
};

export function buildTelnyxCallPayload(opts: {
  to: string;
  from: string;
  connectionId?: string;
  clientState: Record<string, unknown>;
  webhookUrl: string;
  commandId?: string;
}): TelnyxCallPayload {
  return {
    connection_id: opts.connectionId ?? TELNYX_CONNECTION_ID,
    to: opts.to,
    from: opts.from,
    client_state: JSON.stringify(opts.clientState),
    webhook_url: opts.webhookUrl,
    webhook_url_method: "POST",
    command_id: opts.commandId,
  };
}

/**
 * Aftercall voice-agent prompt — paste into Telnyx portal → AI Assistants config.
 * Warm-up → confirm experience → Caleb framing → consent → link watch →
 * no-pressure objections → END. Compliance-safe by construction: no incentives,
 * no happy-customer gating, no coaching of specific services/people (plan §4.2).
 */
export const AFTERCALL_PROMPT = `You are the Aftercall agent for Harbor Voice. You make one short, warm follow-up call after a home-service job is done.

TOOLS
- Use send_message only after the customer has consented to receiving a review link by text message.
- Never call tools for the customer; let them talk.

SCRIPT
1. WARM-UP (first ~10 seconds)
   Greet by name if you have it. Say you're calling from the company that finished the recent job in {city}. Keep it light: "I just wanted to check in quickly — this will only take about 30 seconds."

2. CONFIRM THE EXPERIENCE (don't rush to the ask)
   Ask whether the work got taken care of. Listen. If they mention a problem, acknowledge it plainly and offer to pass it along — do NOT solicit a review.

3. CALEB FRAMING (the core ask — general, not coached)
   Say, in your own words: "Would you mind talking about what happened and what the outcome was?" No leading adjectives, no star-rating language, no naming specific services or people.

4. CONSENT CAPTURE
   If they agree to share feedback, say you'll text them a review link. Ask "Is it okay to text that to you?" Get a clear yes before using send_message. Tell them: "Watch for the review link I'm sending."

5. OBJECTION HANDLING (no pressure, ever)
   - "I don't leave reviews" → "Totally fine — no pressure at all. Thanks for your time."
   - "What will you do with it?" → "It helps the company see how the job went. Purely optional."
   - Mentions of incentives → you never offer money, discounts, or anything in exchange for a review.
   - If they seem annoyed → apologize briefly, end warmly, do not send anything.

6. END
   Thank them by name. Say goodbye. If you promised a text, send it before ending.

RULES
- Never offer incentives, contests, or discounts for a review.
- Never ask only happy customers — everyone gets the same friendly ask.
- Never suggest what to write, which rating to give, or which services/people to mention.
- If the customer opts out ("stop", "don't contact me"), do not send anything and mark the number as opted out.
- Keep every turn short and conversational. No scripts read aloud verbatim.`;

export type SchedulePlan = {
  planned: true;
  phoneNumber: string;
  service: string;
  city: string;
  platform: ReviewPlatform;
  link: string;
  window: typeof REVIEW_WINDOW;
  jobId: string | null;
  dryRun: boolean;
};

export type ScheduleBlocked = {
  planned: false;
  reason: string;
  phoneNumber: string;
};

export type CallResult = {
  placed: boolean;
  dryRun: boolean;
  reason?: string;
  status?: number;
  callControlId?: string;
  callLegId?: string;
  callSessionId?: string;
  isAlive?: boolean;
};

/** True when any stored conversation for this number has optedOut set. */
async function hasOptedOut(ctx: { db: DatabaseReader }, phoneNumber: string): Promise<boolean> {
  const optedOutRows = await ctx.db
    .query("conversations")
    .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
    .filter((q) => q.eq(q.field("optedOut"), true))
    .collect();
  return optedOutRows.length > 0;
}

/**
 * Trigger entry point: a job-closed event calls this to schedule an Aftercall.
 * Guards opt-outs, computes the rotation slot (round-robin over prior outbound
 * voice Aftercalls for this number), and returns the plan. By default (dryRun)
 * it only logs the plan — pass dryRun:false to actually schedule the call via
 * ctx.scheduler → startOutboundCall.
 */
export const scheduleAftercall = mutation({
  args: {
    phoneNumber: v.string(),
    service: v.string(),
    city: v.string(),
    jobId: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<SchedulePlan | ScheduleBlocked> => {
    const dryRun = args.dryRun ?? true;
    if (await hasOptedOut(ctx, args.phoneNumber)) {
      return { planned: false, reason: "opted_out", phoneNumber: args.phoneNumber };
    }
    const prior = (
      await ctx.db
        .query("conversations")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
        .filter((q) =>
          q.and(
            q.eq(q.field("direction"), "outbound"),
            q.eq(q.field("channel"), "voice"),
          ),
        )
        .collect()
    ).length;
    const platform = rotatePlatform(prior);
    const link = REVIEW_LINK_TEMPLATES[platform]({ service: args.service, city: args.city });
    const plan: SchedulePlan = {
      planned: true,
      phoneNumber: args.phoneNumber,
      service: args.service,
      city: args.city,
      platform,
      link,
      window: REVIEW_WINDOW,
      jobId: args.jobId ?? null,
      dryRun,
    };
    console.log(`[aftercall:schedule] ${JSON.stringify(plan)}`);
    if (!dryRun) {
      await ctx.scheduler.runAfter(0, internal.aftercall.startOutboundCall, {
        phoneNumber: args.phoneNumber,
        service: args.service,
        city: args.city,
        platform,
        link,
        jobId: args.jobId,
        dryRun: false,
      });
    }
    return plan;
  },
});

/**
 * Place the outbound call: POST /v2/calls on the owned voice connection.
 * Internal — the public entry point is scheduleAftercall (guards opt-outs +
 * rotation); no client should dial Telnyx directly.
 * dryRun:true (default) logs the would-be payload and never spends Telnyx minutes.
 * On a successful create it records the outbound voice row (feeds rotation + audit).
 */
export const startOutboundCall = internalAction({
  args: {
    phoneNumber: v.string(),
    service: v.string(),
    city: v.string(),
    platform: v.union(v.literal("google"), v.literal("yelp"), v.literal("angi")),
    link: v.string(),
    jobId: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<CallResult> => {
    const dryRun = args.dryRun ?? true;
    const apiKey = process.env.TELNYX_API_KEY;
    const from = process.env.TELNYX_NUMBER;
    const convexUrl = process.env.PUBLIC_CONVEX_URL;

    const clientState = {
      kind: "aftercall",
      jobId: args.jobId ?? null,
      platform: args.platform,
      service: args.service,
      city: args.city,
    };
    const payload = buildTelnyxCallPayload({
      to: args.phoneNumber,
      from: from ?? "",
      clientState,
      webhookUrl: convexUrl ? `${convexUrl}/telnyx-webhook` : "",
      commandId: randomUuid(),
    });

    if (dryRun) {
      console.log(`[aftercall:call:dry-run] ${JSON.stringify(payload)}`);
      return { placed: false, dryRun: true, reason: "dryRun" };
    }
    if (!apiKey || !from || !convexUrl) {
      console.log("[aftercall:call:stub]", {
        reason: "missing env",
        missing: [
          apiKey ? null : "TELNYX_API_KEY",
          from ? null : "TELNYX_NUMBER",
          convexUrl ? null : "PUBLIC_CONVEX_URL",
        ].filter(Boolean),
      });
      return { placed: false, dryRun, reason: "missing TELNYX_API_KEY|TELNYX_NUMBER|PUBLIC_CONVEX_URL" };
    }

    const res = await fetch(TELNYX_CALLS_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[aftercall:call:error] status=${res.status} body=${body}`);
      return { placed: false, dryRun, reason: `Telnyx ${res.status}`, status: res.status };
    }
    const json = (await res.json()) as { data?: Record<string, unknown> };
    const data = json.data ?? {};
    const callControlId = (data.call_control_id ?? data.callControlId) as string | undefined;

    await ctx.runMutation(internal.aftercall.captureReviewEvent, {
      phoneNumber: args.phoneNumber,
      direction: "outbound",
      channel: "voice",
      metadata: {
        kind: "aftercall",
        service: args.service,
        city: args.city,
        platform: args.platform,
        link: args.link,
        jobId: args.jobId ?? null,
        callControlId,
      },
    });

    return {
      placed: true,
      dryRun,
      callControlId,
      callLegId: (data.call_leg_id ?? data.callLegId) as string | undefined,
      callSessionId: (data.call_session_id ?? data.callSessionId) as string | undefined,
      isAlive: (data.is_alive ?? data.isAlive) as boolean | undefined,
    };
  },
});

/**
 * Insert any conversation event (voice/SMS, inbound/outbound) into `conversations`.
 * Preserves an existing opt-out so recording an event can never flip an
 * opted-out customer back to opted-in. Schema-compatible (see convex/schema.ts).
 */
export const captureReviewEvent = internalMutation({
  args: {
    phoneNumber: v.string(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    channel: v.union(v.literal("sms"), v.literal("voice")),
    body: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const optedOut = await hasOptedOut(ctx, args.phoneNumber);
    await ctx.db.insert("conversations", {
      phoneNumber: args.phoneNumber,
      direction: args.direction,
      channel: args.channel,
      body: args.body,
      optedOut,
      metadata: args.metadata,
    });
  },
});

const SERVICE_KEYWORDS = [
  "drain", "sewer", "septic", "plumb", "pipe", "rooter", "water heater",
  "furnace", "hvac", "heating", "cooling", "roof", "electrical", "electric",
  "cleaning", "repair", "install", "leak", "leaky", "appliance",
  "handyman", "painting", "drywall", "gutter", "window", "door", "mold",
  "pest", "landscape",
];

const POSITIVE_PATTERNS = [
  /\b(great|excellent|amazing|fantastic|perfect|wonderful|awesome|outstanding|impressive|solid|happy|pleased)\b/i,
  /\b(fixed|solved|resolved|working|works|repaired|installed|cleaned up|on time|early)\b/i,
  /\b(professional|courteous|friendly|clean|thorough|honest|polite|recommend|recommended|would use again)\b/i,
];

const NEGATIVE_PATTERNS = [
  /\b(slow|rude|unprofessional|expensive|overcharged|sloppy|incomplete|terrible|awful|horrible|worst|disappointed|disappointing)\b/i,
  /\b(still (broken|leaking|not working)|never again|don't call)\b/i,
];

/**
 * Attribute-mining stub: parse the latest conversation for a number into service
 * entities + outcome language (positive/negative/neutral). Honest, regex-based
 * and deliberately simple — TODO: swap for LLM scoring once review volume grows.
 */
export const attributeMine = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    const rows = await ctx.db
      .query("conversations")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
      .take(20);
    const withBody = rows
      .filter((r) => typeof r.body === "string" && r.body.length > 0)
      .sort((a, b) => b._creationTime - a._creationTime);
    const latest = withBody[0]?.body ?? "";
    const lower = latest.toLowerCase();

    const serviceEntities = SERVICE_KEYWORDS.filter((k) => lower.includes(k));
    const positiveHit = POSITIVE_PATTERNS.some((re) => re.test(lower));
    const negativeHit = NEGATIVE_PATTERNS.some((re) => re.test(lower));
    const outcome = positiveHit && !negativeHit ? "positive" : negativeHit ? "negative" : "neutral";

    return {
      phoneNumber,
      reviewedCount: rows.length,
      latestBodySample: latest.slice(0, 200),
      serviceEntities,
      outcome,
      matchedPositive: positiveHit,
      matchedNegative: negativeHit,
      // TODO: LLM scoring — extract service entities + outcome from full transcript.
      extractor: "regex-v0",
    };
  },
});

function randomUuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
