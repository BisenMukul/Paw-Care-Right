/**
 * T096 Phase D: shared, deterministic fuzz-input generator for the webhook
 * and presign fuzz-ish suites. No `Math.random`, no `Date.now`, no
 * `fast-check` (transitive-only in this repo -- see the plan's ground truth
 * and D6: importing it from apps/api would be an undeclared dependency
 * under pnpm's strict layout). `FUZZ_SEED` is fixed and printed by every
 * consuming suite on failure so a red run is always reproducible.
 */

export const FUZZ_SEED = 20260725;

/** A tiny, well-known 32-bit PRNG (public domain). Deterministic for a given seed. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function next(): number {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const HEX_CHARS = "0123456789abcdef";

function randomHex(rng: () => number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += HEX_CHARS[Math.floor(rng() * HEX_CHARS.length)];
  }
  return out;
}

function randomUuidLike(rng: () => number): string {
  return `${randomHex(rng, 8)}-${randomHex(rng, 4)}-4${randomHex(rng, 3)}-8${randomHex(rng, 3)}-${randomHex(rng, 12)}`;
}

export interface HostileKeyEntry {
  label: string;
  key: string;
  /**
   * Whether this key IS confined to the pet's own flat namespace, i.e.
   * `isKeyInPetNamespace(petId, key) === true`, empirically verified
   * (scratchpad probe, see the T096 journal entry) -- because it contains
   * neither a real `/` nor a literal `..` in the remainder, which are the
   * *only* two things that could let a key escape a single-segment
   * namespace defined purely by `/`-delimited object-store keys (S3/MinIO
   * keys are opaque strings with no directory resolution; there is nothing
   * for a percent-encoded or NUL-containing *segment* to "resolve" out of).
   * These entries were never actually uploaded, so real endpoints
   * correctly 404 on them (same class as the existing "well-formed but
   * never-uploaded key -> 404" case in photos.e2e-spec.ts) rather than 400
   * -- that is not a defect, and photos-key-fuzz.spec.ts asserts this
   * confinement property directly rather than a blanket "always false".
   * `false` entries must be rejected at 400 by every endpoint (namespace
   * violation): they carry a real path-segment escape.
   */
  confinedButNeverUploaded: boolean;
}

/** Stable-order corpus of hostile photo keys for a given pet id. */
export function hostilePhotoKeys(petId: string, rng: () => number): HostileKeyEntry[] {
  const prefix = `pets/${petId}/original/`;
  const otherPetId = randomUuidLike(rng);

  return [
    { label: "plain-traversal", key: `${prefix}../../../etc/passwd`, confinedButNeverUploaded: false },
    {
      label: "percent-encoded-dotdot-with-real-slash",
      key: `${prefix}%2e%2e/etc/passwd`,
      confinedButNeverUploaded: false,
    },
    { label: "backslash-dotdot", key: `${prefix}..\\evil.jpg`, confinedButNeverUploaded: false },
    { label: "absolute-path", key: `/${prefix}evil.jpg`, confinedButNeverUploaded: false },
    { label: "leading-dot-slash", key: `${prefix}./evil.jpg`, confinedButNeverUploaded: false },
    {
      label: "prefix-confusion-original-evil-dir",
      key: `pets/${petId}/original-evil/x.jpg`,
      confinedButNeverUploaded: false,
    },
    {
      label: "prefix-confusion-originalx-dir",
      key: `pets/${petId}/originalx/x.jpg`,
      confinedButNeverUploaded: false,
    },
    { label: "sibling-main-dir", key: `pets/${petId}/main/x.jpg`, confinedButNeverUploaded: false },
    {
      label: "another-pet-real-key",
      key: `pets/${otherPetId}/original/real-${randomHex(rng, 8)}.jpg`,
      confinedButNeverUploaded: false,
    },
    {
      label: "fully-percent-encoded-no-real-slash",
      key: `${prefix}%2e%2e%2fetc%2fpasswd`,
      confinedButNeverUploaded: true,
    },
    { label: "nul-byte", key: `${prefix}evil${String.fromCharCode(0)}.jpg`, confinedButNeverUploaded: true },
    { label: "4kb-key", key: `${prefix}${"a".repeat(4096)}.jpg`, confinedButNeverUploaded: true },
    { label: "unicode-two-dot-leader", key: `${prefix}‥evil.jpg`, confinedButNeverUploaded: true },
  ];
}

/** Generic hostile scalar/structural values for DTO field fuzzing. */
export function typeConfusionValues(): unknown[] {
  return [
    undefined,
    null,
    0,
    -1,
    1.5,
    true,
    false,
    "",
    [],
    {},
    ["nested"],
    { nested: true },
    "x".repeat(10_000),
    Number.MAX_SAFE_INTEGER + 1,
  ];
}

function buildDeeplyNestedEvent(depth: number): Record<string, unknown> {
  const root: Record<string, unknown> = { id: "deep-nest-fixture", type: "RENEWAL" };
  let cursor = root;
  for (let i = 0; i < depth; i += 1) {
    const next: Record<string, unknown> = {};
    cursor.nested = next;
    cursor = next;
  }
  return root;
}

export interface HostileWebhookPayload {
  label: string;
  /** A JS value to `.send()` as JSON (supertest/superagent serializes objects). */
  body?: unknown;
  /**
   * Raw JSON text to send verbatim, for values `JSON.stringify` cannot
   * produce (e.g. an unquoted `1e400` numeral that parses to `Infinity`),
   * or a payload that must carry a literal `__proto__` OWN property through
   * the wire (object-literal `{ __proto__: ... }` syntax sets the
   * prototype instead of creating an own key, so `JSON.stringify` on it
   * would never emit the string `"__proto__"` at all). Mutually exclusive
   * with `body`.
   */
  raw?: string;
}

/** Stable-order corpus of hostile RC webhook envelope bodies. */
export function hostileWebhookBodies(rng: () => number): HostileWebhookPayload[] {
  const id = (): string => `fuzz-${Math.floor(rng() * 1e9).toString(36)}`;

  return [
    { label: "event-as-array", body: { event: ["not", "an", "object"] } },
    { label: "event-as-string", body: { event: "not-an-object" } },
    { label: "event-as-number", body: { event: 42 } },
    { label: "event-as-null", body: { event: null } },
    { label: "event-absent", body: { api_version: "1.0" } },
    { label: "event-id-as-number", body: { event: { id: 12345, type: "RENEWAL" } } },
    { label: "event-id-as-object", body: { event: { id: {}, type: "RENEWAL" } } },
    { label: "event-id-as-array", body: { event: { id: [], type: "RENEWAL" } } },
    { label: "event-type-as-object", body: { event: { id: id(), type: {} } } },
    {
      label: "app-user-id-as-object",
      body: { event: { id: id(), type: "RENEWAL", app_user_id: {} } },
    },
    {
      label: "expiration-at-ms-as-string",
      body: { event: { id: id(), type: "RENEWAL", expiration_at_ms: "soon" } },
    },
    { label: "deeply-nested-200", body: { event: buildDeeplyNestedEvent(200) } },
    {
      label: "event-timestamp-ms-infinity",
      raw: `{"event":{"id":"${id()}","type":"RENEWAL","event_timestamp_ms":1e400}}`,
    },
    {
      label: "proto-pollution",
      raw: `{"event":{"id":"${id()}","type":"RENEWAL","__proto__":{"pawcarePolluted":true}}}`,
    },
  ];
}
