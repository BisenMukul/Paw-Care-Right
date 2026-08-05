import type { AdminAuthConfig } from "./admin-env";

/**
 * T111 D1: HTTP Basic auth, the whole mechanism (no session, no cookie).
 * `crypto.subtle` (Web Crypto) is used for the constant-time password
 * compare -- available in the Edge runtime AND Node >= 18 (jest
 * `testEnvironment: node`), so this stays runtime-agnostic with no
 * `node:crypto` import (Edge-unavailable). Same "hash both sides, then
 * compare" shape as the API's `AdminTokenGuard` -- both hashes are a fixed
 * 32-byte SHA-256 digest, so a length difference in the raw input can never
 * leak through comparison time.
 */

export interface BasicAuthCredentials {
  readonly email: string;
  readonly password: string;
}

const BASIC_PREFIX = "Basic ";

/**
 * Returns `null` on: an absent header, a non-"Basic " scheme, undecodable
 * base64, or a decoded value with no `:` separator. Splits on the FIRST
 * colon only, so a password may itself contain a colon.
 */
export function parseBasicAuthHeader(header: string | null | undefined): BasicAuthCredentials | null {
  if (header === null || header === undefined || !header.startsWith(BASIC_PREFIX)) {
    return null;
  }

  const encoded = header.slice(BASIC_PREFIX.length);
  let decoded: string;
  try {
    decoded = globalThis.atob(encoded);
  } catch {
    return null;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }

  return {
    email: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [digestA, digestB] = await Promise.all([
    globalThis.crypto.subtle.digest("SHA-256", encoder.encode(a)),
    globalThis.crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);

  let diff = 0;
  for (let index = 0; index < bytesA.length; index += 1) {
    diff |= (bytesA[index] ?? 0) ^ (bytesB[index] ?? 0);
  }
  return diff === 0;
}

/**
 * Fail-closed (D1): `config === null` (unconfigured deployment) is
 * "unauthorized" even for a well-formed, correct-looking header -- an
 * unconfigured deployment must expose nothing, ever. A wrong email and a
 * wrong password both resolve to the same "unauthorized" outcome, so a
 * caller can never learn which half failed.
 */
export async function authorizeAdminRequest(
  header: string | null | undefined,
  config: AdminAuthConfig | null,
): Promise<"ok" | "unauthorized"> {
  if (config === null) {
    return "unauthorized";
  }

  const credentials = parseBasicAuthHeader(header);
  if (credentials === null) {
    return "unauthorized";
  }

  const emailAllowed = config.allowedEmails.includes(credentials.email.trim().toLowerCase());
  const passwordMatches = await constantTimeEqual(credentials.password, config.password);

  return emailAllowed && passwordMatches ? "ok" : "unauthorized";
}
