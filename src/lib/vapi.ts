// VAPI (vapi.ai) SDK wrapper for Harbor Voice — The Aftercall.
// Provides: assistant CRUD, call placement, campaign management, phone number import.
// Uses Telnyx number imported via SIP trunk or BYO phone number.
//
// Env: VAPI_API_KEY (from .env)

const VAPI_BASE = "https://api.vapi.ai";

/** Aftercall assistant system prompt — matches convex/aftercall.ts AFTERCALL_PROMPT. */
export const AFTERCALL_SYSTEM_PROMPT = `You are a warm, professional follow-up agent for a home-service business. Your name is Harper.

GOAL: After a service job is completed, check in with the customer and invite them to share their experience as a review.

FLOW:
1. Greet the customer by name. Mention the service that was just completed.
2. Ask how the experience was — "What happened, and what was the outcome?"
3. Listen actively. Acknowledge their response.
4. If they had a positive experience, say: "Would you mind sharing that experience as a review? It helps other people find good service. I can text you a direct link right now."
5. If they say yes, call the send_sms tool with the review link.
6. If they say no or are hesitant, say: "No pressure at all — thanks for choosing us!" and end warmly.
7. If they had a negative experience, say: "I'm sorry to hear that. I'll make sure the team knows about this. Is there anything I can do right now to help?" — do NOT push for a review.

RULES:
- Never coach the content of the review
- Never offer incentives for reviews
- Never transcribe and post — the customer writes the review themselves
- Keep the call under 60 seconds
- Always respect STOP/opt-out
- If the customer seems busy, offer to just text the link and let them go`;

/** Aftercall assistant first message. */
export const AFTERCALL_FIRST_MESSAGE =
  "Hi {{name}}! This is Harper from {{business_name}}. I'm just checking in about your {{service}} today — how did everything go?";

/** Tool definition for sending SMS review link during call. */
export const AFTERCALL_SMS_TOOL = {
  type: "endCall" as const,
  // Vapi has native send_message — we configure it per-assistant
  // For now, we use the function tool to log the SMS request
  // and the webhook handler sends the actual SMS via Telnyx
};

async function vapiFetch(path: string, options: RequestInit = {}, apiKey: string) {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`VAPI ${res.status}: ${body}`);
  }
  return res.json();
}

/** Create or update an Aftercall assistant. */
export async function upsertAftercallAssistant(
  apiKey: string,
  opts?: {
    assistantId?: string;
    businessName?: string;
    model?: string;
    provider?: string;
  }
) {
  const payload: Record<string, unknown> = {
    name: "Harbor Aftercall Agent",
    model: {
      provider: opts?.provider ?? "openai",
      model: opts?.model ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: AFTERCALL_SYSTEM_PROMPT,
        },
      ],
    },
    firstMessage: AFTERCALL_FIRST_MESSAGE,
    voicemailMessage:
      "Hi, this is Harper from {{business_name}}. We just wanted to check in about your recent service. If you'd like to share a review, we can text you a link. Have a great day!",
    endCallMessage: "Thanks for your time! We appreciate your business.",
    voicemailDetection: {
      enabled: true,
    },
    server: {
      url: process.env.PUBLIC_CONVEX_URL
        ? `${process.env.PUBLIC_CONVEX_URL}/vapi-webhook`
        : undefined,
    },
  };

  if (opts?.assistantId) {
    return vapiFetch(
      `/assistant/${opts.assistantId}`,
      { method: "PATCH", body: JSON.stringify(payload) },
      apiKey
    );
  }
  return vapiFetch(
    "/assistant",
    { method: "POST", body: JSON.stringify(payload) },
    apiKey
  );
}

/** Import a Telnyx phone number into Vapi. */
export async function importTelnyxNumber(
  apiKey: string,
  opts: {
    telnyxApiKey: string;
    phoneNumber: string;
    name?: string;
  }
) {
  // Step 1: Create SIP trunk credential for Telnyx
  const credential = await vapiFetch(
    "/credential",
    {
      method: "POST",
      body: JSON.stringify({
        provider: "byo-sip-trunk",
        name: `Telnyx SIP - ${opts.phoneNumber}`,
        gateways: [
          {
            // Telnyx SIP domain for outbound
            ip: "sip.telnyx.com",
            port: "5060",
            inboundEnabled: false,
          },
        ],
        sipAuthentication: {
          username: opts.phoneNumber.replace("+", ""),
          password: opts.telnyxApiKey,
        },
      }),
    },
    apiKey
  );

  // Step 2: Register the phone number
  const phoneNumberResource = await vapiFetch(
    "/phone-number",
    {
      method: "POST",
      body: JSON.stringify({
        provider: "byo-phone-number",
        name: opts.name ?? `Telnyx ${opts.phoneNumber}`,
        number: opts.phoneNumber,
        credentialId: credential.id,
      }),
    },
    apiKey
  );

  return { credential, phoneNumber: phoneNumberResource };
}

/** Place an outbound Aftercall. */
export async function placeAftercall(
  apiKey: string,
  opts: {
    assistantId: string;
    phoneNumberId: string;
    customerNumber: string;
    customerName?: string;
    businessName?: string;
    service?: string;
    reviewLink?: string;
  }
) {
  const payload: Record<string, unknown> = {
    assistantId: opts.assistantId,
    phoneNumberId: opts.phoneNumberId,
    customer: {
      number: opts.customerNumber,
    },
    assistantOverrides: {
      variableValues: {
        name: opts.customerName ?? "there",
        business_name: opts.businessName ?? "your service provider",
        service: opts.service ?? "recent service",
        review_link: opts.reviewLink ?? "",
      },
    },
  };

  return vapiFetch(
    "/call/phone",
    { method: "POST", body: JSON.stringify(payload) },
    apiKey
  );
}

/** Schedule an outbound Aftercall for later. */
export async function scheduleAftercall(
  apiKey: string,
  opts: {
    assistantId: string;
    phoneNumberId: string;
    customerNumber: string;
    customerName?: string;
    businessName?: string;
    service?: string;
    reviewLink?: string;
    earliestAt: string; // ISO datetime
    latestAt?: string; // ISO datetime
  }
) {
  const payload: Record<string, unknown> = {
    assistantId: opts.assistantId,
    phoneNumberId: opts.phoneNumberId,
    customer: {
      number: opts.customerNumber,
    },
    assistantOverrides: {
      variableValues: {
        name: opts.customerName ?? "there",
        business_name: opts.businessName ?? "your service provider",
        service: opts.service ?? "recent service",
        review_link: opts.reviewLink ?? "",
      },
    },
    schedulePlan: {
      earliestAt: opts.earliestAt,
      ...(opts.latestAt ? { latestAt: opts.latestAt } : {}),
    },
  };

  return vapiFetch(
    "/call/phone",
    { method: "POST", body: JSON.stringify(payload) },
    apiKey
  );
}

/** Create a batch campaign for multiple aftercalls. */
export async function createAftercallCampaign(
  apiKey: string,
  opts: {
    assistantId: string;
    phoneNumberId: string;
    customers: Array<{
      number: string;
      name?: string;
      service?: string;
      reviewLink?: string;
    }>;
    businessName?: string;
    maxConcurrency?: number;
  }
) {
  const payload = {
    name: `Aftercall Campaign - ${new Date().toISOString().slice(0, 10)}`,
    assistantId: opts.assistantId,
    phoneNumberId: opts.phoneNumberId,
    maxConcurrency: opts.maxConcurrency ?? 5,
    customers: opts.customers.map((c) => ({
      number: c.number,
      assistantOverrides: {
        variableValues: {
          name: c.name ?? "there",
          business_name: opts.businessName ?? "your service provider",
          service: c.service ?? "recent service",
          review_link: c.reviewLink ?? "",
        },
      },
    })),
  };

  return vapiFetch(
    "/v2/campaign",
    { method: "POST", body: JSON.stringify(payload) },
    apiKey
  );
}

/** List all assistants. */
export async function listAssistants(apiKey: string) {
  return vapiFetch("/assistant", { method: "GET" }, apiKey);
}

/** List all phone numbers. */
export async function listPhoneNumbers(apiKey: string) {
  return vapiFetch("/phone-number", { method: "GET" }, apiKey);
}

/** Get call details. */
export async function getCall(apiKey: string, callId: string) {
  return vapiFetch(`/call/${callId}`, { method: "GET" }, apiKey);
}

/** Load VAPI_API_KEY from .env. */
export function loadVapiKey(): string {
  const envPath = new URL("../../.env", import.meta.url).pathname;
  try {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("VAPI_API_KEY=")) {
        return trimmed.slice("VAPI_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
  if (process.env.VAPI_API_KEY) return process.env.VAPI_API_KEY;
  throw new Error("VAPI_API_KEY not set (add to .env)");
}

import { readFileSync } from "node:fs";
