import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { readFileSyncMock } = vi.hoisted(() => ({
  readFileSyncMock: vi.fn(),
}));

vi.mock("node:fs", () => ({ readFileSync: readFileSyncMock }));

import {
  AFTERCALL_FIRST_MESSAGE,
  AFTERCALL_SYSTEM_PROMPT,
  createAftercallCampaign,
  getCall,
  importTelnyxNumber,
  listAssistants,
  listPhoneNumbers,
  loadVapiKey,
  placeAftercall,
  scheduleAftercall,
  upsertAftercallAssistant,
} from "../src/lib/vapi";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => body,
  } as unknown as Response;
}

const API_KEY = "vapi-test-key";

function lastCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: url as string, init: init as RequestInit };
}

function sentBody(init: RequestInit): any {
  return JSON.parse(init.body as string);
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe("upsertAftercallAssistant", () => {
  it("creates the assistant with the Harbor Aftercall payload", async () => {
    vi.stubEnv("PUBLIC_CONVEX_URL", "https://site.convex.site");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "asst_new" }));
    const result = await upsertAftercallAssistant(API_KEY);
    expect(result).toEqual({ id: "asst_new" });
    const { url, init } = lastCall();
    expect(url).toBe("https://api.vapi.ai/assistant");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
    const payload = sentBody(init);
    expect(payload.name).toBe("Harbor Aftercall Agent");
    expect(payload.model.provider).toBe("openai");
    expect(payload.model.model).toBe("gpt-4o-mini");
    expect(payload.model.messages).toEqual([
      { role: "system", content: AFTERCALL_SYSTEM_PROMPT },
    ]);
    expect(payload.firstMessage).toBe(AFTERCALL_FIRST_MESSAGE);
    expect(payload.voicemailDetection).toEqual({ enabled: true });
    expect(payload.server.url).toBe("https://site.convex.site/vapi-webhook");
  });

  it("omits the webhook server URL when PUBLIC_CONVEX_URL is unset", async () => {
    vi.stubEnv("PUBLIC_CONVEX_URL", "");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await upsertAftercallAssistant(API_KEY);
    expect(sentBody(lastCall().init).server.url).toBeUndefined();
  });

  it("patches instead of posting when an assistantId is given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "asst_1" }));
    await upsertAftercallAssistant(API_KEY, {
      assistantId: "asst_1",
      provider: "openai",
      model: "gpt-4o",
    });
    const { url, init } = lastCall();
    expect(url).toBe("https://api.vapi.ai/assistant/asst_1");
    expect(init.method).toBe("PATCH");
    expect(sentBody(init).model.model).toBe("gpt-4o");
  });

  it("throws a VAPI error with status on failure", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, "unauthorized"));
    await expect(upsertAftercallAssistant("bad-key")).rejects.toThrow(
      "VAPI 401: unauthorized"
    );
  });
});

describe("importTelnyxNumber", () => {
  it("creates a credential then the phone number linked to it", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "cred_1" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "pn_1" }));
    const result = await importTelnyxNumber(API_KEY, {
      telnyxApiKey: "telnyx-key",
      phoneNumber: "+15165551234",
    });
    expect(result.credential).toEqual({ id: "cred_1" });
    expect(result.phoneNumber).toEqual({ id: "pn_1" });
    const [credCall, pnCall] = fetchMock.mock.calls;
    expect(credCall[0]).toBe("https://api.vapi.ai/credential");
    expect(JSON.parse(credCall[1].body as string)).toEqual({
      provider: "telnyx",
      name: "Telnyx - +15165551234",
      apiKey: "telnyx-key",
    });
    expect(pnCall[0]).toBe("https://api.vapi.ai/phone-number");
    expect(JSON.parse(pnCall[1].body as string)).toEqual({
      provider: "telnyx",
      name: "Aftercall - +15165551234",
      number: "+15165551234",
      credentialId: "cred_1",
    });
  });

  it("uses a provided name for the phone number", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "cred_2" }))
      .mockResolvedValueOnce(jsonResponse(200, {}));
    await importTelnyxNumber(API_KEY, {
      telnyxApiKey: "k",
      phoneNumber: "+1",
      name: "Custom",
    });
    const [, pnCall] = fetchMock.mock.calls;
    expect(JSON.parse(pnCall[1].body as string).name).toBe("Custom");
  });
});

describe("call placement", () => {
  const base = {
    assistantId: "asst_1",
    phoneNumberId: "pn_1",
    customerNumber: "+15165559999",
  };

  it("placeAftercall defaults the variable values", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "call_1" }));
    await placeAftercall(API_KEY, base);
    const { url, init } = lastCall();
    expect(url).toBe("https://api.vapi.ai/call/phone");
    expect(init.method).toBe("POST");
    expect(sentBody(init)).toEqual({
      assistantId: "asst_1",
      phoneNumberId: "pn_1",
      customer: { number: "+15165559999" },
      assistantOverrides: {
        variableValues: {
          name: "there",
          business_name: "your service provider",
          service: "recent service",
          review_link: "",
        },
      },
    });
  });

  it("placeAftercall honors provided values", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await placeAftercall(API_KEY, {
      ...base,
      customerName: "Jo",
      businessName: "Acme",
      service: "leak repair",
      reviewLink: "https://r.link",
    });
    expect(sentBody(lastCall().init).assistantOverrides.variableValues).toEqual({
      name: "Jo",
      business_name: "Acme",
      service: "leak repair",
      review_link: "https://r.link",
    });
  });

  it("scheduleAftercall adds a schedulePlan with optional latestAt", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await scheduleAftercall(API_KEY, { ...base, earliestAt: "2026-11-01T15:00:00Z" });
    expect(sentBody(lastCall().init).schedulePlan).toEqual({
      earliestAt: "2026-11-01T15:00:00Z",
    });

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await scheduleAftercall(API_KEY, {
      ...base,
      earliestAt: "2026-11-01T15:00:00Z",
      latestAt: "2026-11-01T18:00:00Z",
    });
    expect(sentBody(lastCall().init).schedulePlan).toEqual({
      earliestAt: "2026-11-01T15:00:00Z",
      latestAt: "2026-11-01T18:00:00Z",
    });
  });
});

describe("createAftercallCampaign", () => {
  it("builds the v2 campaign payload", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "camp_1" }));
    await createAftercallCampaign(API_KEY, {
      assistantId: "asst_1",
      phoneNumberId: "pn_1",
      customers: [
        { number: "+1a", name: "A", service: "s", reviewLink: "l" },
        { number: "+1b" },
      ],
      businessName: "Acme",
    });
    const { url, init } = lastCall();
    expect(url).toBe("https://api.vapi.ai/v2/campaign");
    const payload = sentBody(init);
    expect(payload.name).toMatch(/^Aftercall Campaign - \d{4}-\d{2}-\d{2}$/);
    expect(payload.assistantId).toBe("asst_1");
    expect(payload.phoneNumberId).toBe("pn_1");
    expect(payload.maxConcurrency).toBe(5);
    expect(payload.customers).toEqual([
      {
        number: "+1a",
        assistantOverrides: {
          variableValues: {
            name: "A",
            business_name: "Acme",
            service: "s",
            review_link: "l",
          },
        },
      },
      {
        number: "+1b",
        assistantOverrides: {
          variableValues: {
            name: "there",
            business_name: "Acme",
            service: "recent service",
            review_link: "",
          },
        },
      },
    ]);
  });

  it("honors maxConcurrency", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await createAftercallCampaign(API_KEY, {
      assistantId: "a",
      phoneNumberId: "p",
      customers: [],
      maxConcurrency: 9,
    });
    expect(sentBody(lastCall().init).maxConcurrency).toBe(9);
  });
});

describe("simple listings", () => {
  it("lists assistants, phone numbers, and gets calls", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await listAssistants(API_KEY);
    expect(lastCall()).toMatchObject({
      url: "https://api.vapi.ai/assistant",
      init: { method: "GET" },
    });
    await listPhoneNumbers(API_KEY);
    expect(lastCall()).toMatchObject({
      url: "https://api.vapi.ai/phone-number",
      init: { method: "GET" },
    });
    await getCall(API_KEY, "call_7");
    expect(lastCall()).toMatchObject({
      url: "https://api.vapi.ai/call/call_7",
      init: { method: "GET" },
    });
  });
});

describe("loadVapiKey", () => {
  it("falls back to the process env when .env lacks the key", () => {
    readFileSyncMock.mockReturnValue("OTHER=value\n");
    vi.stubEnv("VAPI_PRIVATE_KEY", "env-secret");
    expect(loadVapiKey()).toBe("env-secret");
  });

  it("throws when no key is configured anywhere", () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    vi.stubEnv("VAPI_PRIVATE_KEY", "");
    expect(() => loadVapiKey()).toThrow("VAPI_PRIVATE_KEY not set (add to .env)");
  });
});
