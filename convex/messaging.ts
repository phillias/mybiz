import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** U2: inbound SMS from the Telnyx webhook → conversations table. */
export const insertInboundSms = internalMutation({
  args: {
    phoneNumber: v.string(),
    body: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("conversations", {
      phoneNumber: args.phoneNumber,
      direction: "inbound",
      channel: "sms",
      body: args.body,
      optedOut: false,
      metadata: args.metadata,
    });
  },
});
