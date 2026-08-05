// T089 (Sentry everywhere + release tagging) — shared, pure PII scrubber.
//
// Runtime-neutral (node/RN/browser): operates on a STRUCTURAL type only, so
// this package never imports `@sentry/*` and stays zero-new-deps (plan D1).
// The real SDK's event shape is verified against this structural type by the
// api's mock-transport spec (`apps/api/src/observability/sentry.spec.ts`),
// which runs a real `@sentry/node` pipeline end to end.
//
// SAFETY (CLAUDE §7 / plan "Safety statement"): intake text and chat content
// travel in `request.data` — the §5-sensitive payload. It is dropped
// STRUCTURALLY (not by key-matching) so a new endpoint can never leak by
// omission. Everything else (emails, bearer tokens, JWTs) is caught by a
// cycle-safe deep redaction walk over every remaining string in the event.
// Any internal failure returns `null` (drop the event) — fail CLOSED:
// losing telemetry is acceptable, leaking an owner's symptom description or
// a pet's name/notes is not.

export interface SentryEventLike {
  event_id?: string;
  message?: unknown;
  level?: string;
  release?: string;
  environment?: string;
  user?: {
    id?: string;
    email?: string;
    ip_address?: string;
    username?: string;
    [k: string]: unknown;
  };
  request?: {
    url?: string;
    query_string?: unknown;
    data?: unknown;
    cookies?: unknown;
    headers?: Record<string, string>;
    [k: string]: unknown;
  };
  breadcrumbs?: Array<{
    category?: string;
    message?: string;
    data?: Record<string, unknown>;
    [k: string]: unknown;
  }>;
  exception?: unknown;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  [k: string]: unknown;
}

export const REDACTED = "[REDACTED]";

const ALLOWED_REQUEST_HEADER_KEYS = ["host", "user-agent", "content-type", "content-length"];
const ALLOWED_BREADCRUMB_DATA_KEYS = ["method", "status_code", "category"];

// T089 finding F1: the breadcrumb channel is a structural leak the plan's
// original D3 design missed. `@sentry/node`/`@sentry/react-native`'s default
// `consoleIntegration` turns every `console.*` call (which is exactly how
// `@nestjs/common`'s `ConsoleLogger` — and the mobile app's two justified
// `console.error` call sites — write) into a `category: "console"`
// breadcrumb whose `message` is the raw formatted log line and whose
// `data.arguments` is the raw argument array — i.e. an ARBITRARY-free-text
// sink that the pattern-only `redactDeep` cannot fully cover (it only
// catches emails/tokens/JWTs, not arbitrary content). A manual
// `addBreadcrumb({ message })` call (any category) carries the same risk.
// Fix (dropping, not merely redacting — "close the CHANNEL"): `message` is
// dropped WHOLESALE from every breadcrumb regardless of category (mirrors
// the `request.data` structural drop), and `console`-category breadcrumbs
// are dropped ENTIRELY (data.arguments included) — losing little, since
// that same log line already exists in server/device logs via the
// process's own logger.
const DROPPED_BREADCRUMB_CATEGORIES = new Set(["console"]);

// Order matters: `Bearer <token>` and JWT-shaped strings are matched before
// the generic email pattern so a token embedded next to an email is fully
// redacted rather than partially matched.
const BEARER_RE = /Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
// The TLD segment is restricted to letters (length >= 2, no digits) so a
// release string like `bombaypetcompany@0.0.0+abc1234` (digit-only version) is
// never mistaken for an email address and redacted by accident.
const EMAIL_RE = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}/g;

function redactString(input: string): string {
  return input.replace(BEARER_RE, REDACTED).replace(JWT_RE, REDACTED).replace(EMAIL_RE, REDACTED);
}

function truncateAtQuery(url: string): string {
  const index = url.indexOf("?");
  return index === -1 ? url : url.slice(0, index);
}

/**
 * Cycle-safe deep redaction walk. Builds an entirely new value tree (never
 * mutates `value`), replacing every string leaf via `redactString`. `seen`
 * is a PATH-scoped guard (added on enter, removed on exit) so a true cycle
 * is replaced with `"[Circular]"` while a shared (non-cyclic) reference
 * visited from two different branches is still walked correctly on each.
 * Any access that throws (e.g. a pathological getter) propagates to the
 * caller — `scrubSentryEvent`'s outer try/catch turns that into `null`
 * (fail closed), never a silent partial scrub.
 */
function redactDeep(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item: unknown) => redactDeep(item, seen));
    }
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      result[key] = redactDeep((value as Record<string, unknown>)[key], seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

// T089 finding F3: `request` is now an ALLOWLIST, not a deny-list. The
// original deny-list (`data`/`cookies`/`query_string`/`url`/`headers`
// dropped, everything else copied through) let an unenumerated SDK field —
// e.g. `request.env` (CGI-style vars such as `REMOTE_ADDR`, a client IP) —
// survive verbatim, contradicting the allowlist discipline already used for
// headers and breadcrumb data. Only `url` (truncated at `?`), `method`, and
// `headers` (further reduced to `ALLOWED_REQUEST_HEADER_KEYS`) survive;
// everything else — `data`, `cookies`, `query_string`, `env`, and any future
// SDK field — is dropped by omission, not by name, so a new field can never
// leak.
function scrubRequest(
  request: NonNullable<SentryEventLike["request"]>,
): NonNullable<SentryEventLike["request"]> {
  const scrubbed: SentryEventLike["request"] = {};

  if (typeof request.url === "string") {
    scrubbed.url = truncateAtQuery(request.url);
  }

  if (typeof request.method === "string") {
    scrubbed.method = request.method;
  }

  if (request.headers) {
    const allowedHeaders: Record<string, string> = {};
    for (const [key, headerValue] of Object.entries(request.headers)) {
      if (ALLOWED_REQUEST_HEADER_KEYS.includes(key.toLowerCase())) {
        allowedHeaders[key] = headerValue;
      }
    }
    scrubbed.headers = allowedHeaders;
  }

  return scrubbed;
}

export type Breadcrumb = NonNullable<SentryEventLike["breadcrumbs"]>[number];

// Structural drop (F1 extension of D3): `message` never survives on ANY
// breadcrumb, regardless of category — it is the arbitrary-free-text field
// that carries a formatted console line (probe A) or a manual
// `addBreadcrumb({ message })` call (probe D).
const DROPPED_BREADCRUMB_KEYS = new Set(["data", "message"]);

/**
 * Per-breadcrumb structural scrub (plan D3 + F1 extension): drops `message`
 * WHOLESALE (arbitrary free text, any category) and reduces `data` to the
 * allowlist; returns `null` for `console`-category breadcrumbs (dropped
 * entirely — see the `DROPPED_BREADCRUMB_CATEGORIES` comment above). Used
 * both by `scrubSentryEvent` (final event-level pass, `beforeSend`) and
 * exported as `scrubBreadcrumb` for the SDK's `beforeBreadcrumb` hook, so
 * the channel is closed regardless of which hook a given breadcrumb passes
 * through.
 */
function scrubOneBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (typeof crumb.category === "string" && DROPPED_BREADCRUMB_CATEGORIES.has(crumb.category)) {
    return null;
  }

  const scrubbed: Breadcrumb = {};
  for (const key of Object.keys(crumb)) {
    if (!DROPPED_BREADCRUMB_KEYS.has(key)) {
      scrubbed[key] = crumb[key];
    }
  }

  const data = crumb.data;
  const scrubbedData: Record<string, unknown> = {};
  if (data) {
    for (const key of ALLOWED_BREADCRUMB_DATA_KEYS) {
      if (key in data) {
        scrubbedData[key] = data[key];
      }
    }
    if (typeof data.url === "string") {
      scrubbedData.url = truncateAtQuery(data.url);
    }
  }
  scrubbed.data = scrubbedData;

  return scrubbed;
}

function scrubBreadcrumbs(
  breadcrumbs: NonNullable<SentryEventLike["breadcrumbs"]>,
): NonNullable<SentryEventLike["breadcrumbs"]> {
  const scrubbed: Breadcrumb[] = [];
  for (const crumb of breadcrumbs) {
    const result = scrubOneBreadcrumb(crumb);
    if (result !== null) {
      scrubbed.push(result);
    }
  }
  return scrubbed;
}

/**
 * `beforeBreadcrumb` hook (plan D1/F1): pure, never throws (a breadcrumb
 * hook is best-effort observability, never load-bearing) — any internal
 * failure drops the breadcrumb (fail closed) rather than risk leaking it
 * unscrubbed.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  try {
    return scrubOneBreadcrumb(breadcrumb);
  } catch {
    return null;
  }
}

/**
 * Structural drops + deep redaction (plan D3). Pure: never mutates `event`,
 * always returns a new object (or `null`). Never throws — a pathological
 * event (e.g. a throwing getter) is caught and dropped, not partially
 * scrubbed and leaked.
 */
export function scrubSentryEvent(event: SentryEventLike): SentryEventLike | null {
  try {
    // Object spread invokes every own-property getter eagerly — a
    // pathological getter throws here, inside the try, and the event is
    // dropped rather than silently half-scrubbed.
    const scrubbed: SentryEventLike = { ...event };

    if (event.request) {
      scrubbed.request = scrubRequest(event.request);
    }

    if (event.user) {
      if (event.user.id !== undefined) {
        scrubbed.user = { id: event.user.id };
      } else {
        delete scrubbed.user;
      }
    }

    if (event.breadcrumbs) {
      scrubbed.breadcrumbs = scrubBreadcrumbs(event.breadcrumbs);
    }

    return redactDeep(scrubbed, new WeakSet<object>()) as SentryEventLike;
  } catch {
    return null;
  }
}
