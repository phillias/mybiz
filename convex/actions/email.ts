"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

/**
 * U1: transactional email via Resend. Called from Convex actions when a
 * scheduled job or webhook fires (publish confirm, rank-drop alert, onboarding).
 */
export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.optional(v.string()),
    text: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM ?? "no-reply@harborseo.ai";
    if (!apiKey) {
      // Dev-mode no-op: log instead of failing the pipeline.
      console.log("[email:stub]", { from, to: args.to, subject: args.subject });
      return { sent: false, reason: "RESEND_API_KEY not set" };
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend error ${res.status}: ${await res.text()}`);
    }
    return { sent: true, id: ((await res.json()) as { id: string }).id };
  },
});
