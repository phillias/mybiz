/**
 * Telnyx webhook signature verification (Ed25519, Web Crypto — edge-safe).
 *
 * Telnyx signs webhook payloads with an Ed25519 keypair; the public key lives
 * in Mission Control → API Keys → Public Key (TELNYX_PUBLIC_KEY env).
 * Signature = Ed25519 over the string `${timestamp}|${rawBody}`, Base64 in
 * header `telnyx-signature-ed25519`; timestamp (Unix seconds) in `telnyx-timestamp`.
 */

export async function verifyTelnyxSignature(
  publicKeyB64: string,
  signatureB64: string,
  message: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    b64ToBytes(publicKeyB64),
    "Ed25519",
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "Ed25519",
    key,
    b64ToBytes(signatureB64),
    new TextEncoder().encode(message),
  );
}

export function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function b64FromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
