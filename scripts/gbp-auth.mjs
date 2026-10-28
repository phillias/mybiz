#!/usr/bin/env node
// GBP OAuth bootstrap: authorize business.manage with the gws-axi Google client
// (787379184548-4f7ou…, Desktop app type — accepts any 127.0.0.1 loopback port).
//
//   node scripts/gbp-auth.mjs                 # listener flow: prints consent URL, waits for callback
//   node scripts/gbp-auth.mjs --code "<full callback URL or code>"
//                                             # headless flow: paste the (failed) redirect URL from a
//                                             # browser on another machine; exchange runs here
//   node scripts/gbp-auth.mjs --refresh       # exchange GBP_REFRESH_TOKEN for a fresh access token
//
// On success writes to .env (gitignored): GBP_ACCESS_TOKEN, GBP_REFRESH_TOKEN,
// GBP_OAUTH_CLIENT_ID, GBP_OAUTH_CLIENT_SECRET. NEVER prints secrets or tokens.
//
// Prereqs: business.manage enabled on the client's GCP project (done 2026-10-01);
// the signing-in Google account must be an owner/manager of the target GBP.
// Desktop-app clients accept any http://127.0.0.1:PORT redirect — no console edit needed.

import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

try {
  process.loadEnvFile(".env");
} catch {
  /* no .env yet — fine */
}

const CRED_FILE = "/home/ubuntu/.config/gws-axi/credentials.json";
const SCOPE = "https://www.googleapis.com/auth/business.manage";
const AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const TIMEOUT_MS = 30 * 60 * 1000;

const creds = JSON.parse(readFileSync(CRED_FILE, "utf8")).installed;

function readEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const m = readFileSync(".env", "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
    return m ? m[1].trim() : undefined;
  } catch {
    return undefined;
  }
}

function upsertEnv(key, value) {
  let cur = "";
  try {
    cur = readFileSync(".env", "utf8");
  } catch {
    /* new file */
  }
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (re.test(cur)) writeFileSync(".env", cur.replace(re, line));
  else writeFileSync(".env", cur ? `${cur.replace(/\n*$/, "\n")}${line}\n` : `${line}\n`);
}

async function exchange(codeValue, redirectUri) {
  const body = new URLSearchParams({
    code: codeValue,
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const tok = await res.json();
  if (!res.ok) {
    console.error(`Token exchange failed (${res.status}): ${JSON.stringify(tok).slice(0, 300)}`);
    process.exit(1);
  }
  return tok;
}

function finish(tok) {
  upsertEnv("GBP_ACCESS_TOKEN", tok.access_token);
  if (tok.refresh_token) upsertEnv("GBP_REFRESH_TOKEN", tok.refresh_token);
  upsertEnv("GBP_OAUTH_CLIENT_ID", creds.client_id);
  upsertEnv("GBP_OAUTH_CLIENT_SECRET", creds.client_secret);
  console.log(
    `OK — GBP_ACCESS_TOKEN${tok.refresh_token ? " + GBP_REFRESH_TOKEN" : " (no refresh token; re-run to retry)"} written to .env`
  );
}

const args = process.argv.slice(2);
const portArg = args.includes("--port") ? parseInt(args[args.indexOf("--port") + 1], 10) : null;

// --- --refresh mode ---
if (args.includes("--refresh")) {
  const rt = readEnv("GBP_REFRESH_TOKEN");
  if (!rt) {
    console.error("GBP_REFRESH_TOKEN not set — run the listener or --code flow first");
    process.exit(1);
  }
  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: rt,
      grant_type: "refresh_token",
    }),
  });
  const tok = await res.json();
  if (!res.ok) {
    console.error(`Refresh failed (${res.status}) — token likely expired (Testing-mode apps: 7 days). Re-run the full flow: ${JSON.stringify(tok).slice(0, 200)}`);
    process.exit(1);
  }
  finish(tok);
  process.exit(0);
}

// --- --code mode: complete from a pasted callback URL ---
if (args.includes("--code")) {
  const raw = args[args.indexOf("--code") + 1];
  if (!raw) {
    console.error("--code <url-or-code> required");
    process.exit(1);
  }
  let codeValue = raw;
  let redirectUri = "http://127.0.0.1";
  try {
    const u = new URL(raw);
    const c = u.searchParams.get("code");
    if (c) {
      codeValue = c;
      redirectUri = `${u.protocol}//${u.host}${u.pathname.replace(/\/$/, "")}`;
    }
  } catch {
    /* plain code passed */
  }
  finish(await exchange(codeValue, redirectUri));
  process.exit(0);
}

// --- listener flow (default) ---
const state = randomUUID();
let code = null;

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const c = url.searchParams.get("code");
  if (c) {
    code = url.searchParams.get("state") === state ? c : null;
    res.writeHead(200, { "content-type": "text/html" });
    res.end(
      code
        ? "<h1>GBP OAuth OK</h1><p>Token captured. You can close this tab.</p>"
        : "<h1>State mismatch</h1><p>URL stale — re-run the script.</p>"
    );
    return;
  }
  res.writeHead(400);
  res.end("Waiting for the OAuth callback…");
});

await new Promise((resolve) => server.listen(portArg || 0, "127.0.0.1", resolve));
const port = server.address().port;
const redirectUri = `http://127.0.0.1:${port}`;

const params = new URLSearchParams({
  client_id: creds.client_id,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: SCOPE,
  access_type: "offline",
  prompt: "consent",
  state,
});

console.log(`\nListening on ${redirectUri}`);
console.log(`\n1. If your browser is on another machine, tunnel first:\n   ssh -N -L ${port}:127.0.0.1:${port} <this-server>`);
console.log(`2. Open this URL in a browser signed into the Google account that manages the target GBP:\n\n${AUTH_URI}?${params}\n`);
console.log(`Waiting up to ${TIMEOUT_MS / 60000} minutes for the callback… (or paste the redirect URL: node scripts/gbp-auth.mjs --code "<url>")`);

const started = Date.now();
while (!code && Date.now() - started < TIMEOUT_MS) {
  await new Promise((r) => setTimeout(r, 500));
}
server.close();

if (!code) {
  console.error("Timed out waiting for the OAuth callback.");
  process.exit(1);
}

finish(await exchange(code, redirectUri));
