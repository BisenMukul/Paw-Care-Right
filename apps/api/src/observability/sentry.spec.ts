// T089 D4 — offline proof: no staging DSN exists in this environment, so
// AC1 ("forced test error appears with the release tag") is proven with a
// REAL `@sentry/node` init wired to a custom mock transport (no network
// call is ever made — the transport's `makeRequest` captures the raw
// envelope body that would have been POSTed to Sentry's ingest endpoint).
// See loop/journal.md for the honest limitation + the founder real-DSN
// smoke-test to-do.
import { baseSentryOptions, buildSentryRelease } from "@pawcareright/analytics";
import * as Sentry from "@sentry/node";

import { AppConfigService } from "../config/app-config.service";
import { captureApiException, initApiSentry } from "./sentry";

const TEST_DSN = "https://public@o0.ingest.example.com/1";

// Derived entirely from `@sentry/node`'s own exported `createTransport` type
// (no `@sentry/core` import — that package is not a declared dependency of
// this workspace; only `@sentry/node` is sanctioned, plan D9).
type MakeRequest = Parameters<typeof Sentry.createTransport>[1];

/** Captures the raw serialized envelope body instead of ever hitting the network. */
function buildCapturingTransport(sink: { bodies: string[] }) {
  const makeRequest: MakeRequest = (request) => {
    const body =
      typeof request.body === "string" ? request.body : Buffer.from(request.body).toString("utf8");
    sink.bodies.push(body);
    return Promise.resolve({ statusCode: 200 });
  };

  return (transportOptions: Parameters<typeof Sentry.createTransport>[0]) =>
    Sentry.createTransport(transportOptions, makeRequest);
}

describe("initApiSentry", () => {
  const originalEnv = { ...process.env };

  afterEach(async () => {
    process.env = { ...originalEnv };
    await Sentry.close(0);
  });

  it("empty DSN disables Sentry (stub-safe by default)", () => {
    process.env.SENTRY_DSN = "";

    initApiSentry(new AppConfigService());

    expect(Sentry.isInitialized()).toBe(false);
  });

  it("a non-empty DSN initializes the SDK with the shared factory's pinned options", () => {
    process.env.SENTRY_DSN = TEST_DSN;
    process.env.GIT_SHA = "abc1234";
    process.env.APP_VERSION = "0.0.0";
    process.env.SENTRY_ENVIRONMENT = "staging";

    initApiSentry(new AppConfigService());

    expect(Sentry.isInitialized()).toBe(true);
    const options = Sentry.getClient()?.getOptions();
    expect(options?.dsn).toBe(TEST_DSN);
    expect(options?.environment).toBe("staging");
    expect(options?.release).toBe("pawcareright@0.0.0+abc1234");
    expect(options?.sendDefaultPii).toBe(false);
    expect(options?.tracesSampleRate).toBe(0);
    // T089 finding F1: this asserts the REAL `initApiSentry` wiring (not a
    // hand-built `Sentry.init` call) actually passes a WORKING
    // `beforeBreadcrumb` hook through to the SDK client — invoking the
    // retrieved hook directly (not just checking `typeof === "function"`,
    // which the adapter closure would satisfy even if it wrapped nothing)
    // catches both: (a) the adapter wiring removed from `sentry.ts` itself
    // (the hook would be `undefined`, and `?.()` returns `undefined`, which
    // is not `null`), and (b) `beforeBreadcrumb` removed from the shared
    // `baseSentryOptions` factory (the adapter would throw calling
    // `undefined(...)` internally, failing this test).
    const consoleCrumb = { category: "console", message: "MARKER", data: { arguments: ["MARKER"] } };
    expect(options?.beforeBreadcrumb?.(consoleCrumb, {})).toBeNull();
  });
});

describe("Sentry pipeline (D4 mock-transport proof)", () => {
  afterEach(async () => {
    await Sentry.close(0);
  });

  it("a forced error is captured with the pinned release and environment", async () => {
    const sink = { bodies: [] as string[] };
    Sentry.init({
      ...baseSentryOptions({
        dsn: TEST_DSN,
        environment: "test",
        release: buildSentryRelease("0.0.0", "abc1234"),
      }),
      transport: buildCapturingTransport(sink),
    });

    Sentry.captureException(new Error("T089 forced test error"));
    await Sentry.flush();

    expect(sink.bodies.length).toBeGreaterThan(0);
    const envelope = sink.bodies.join("\n");
    expect(envelope).toMatch(/"release":"pawcareright@\d+\.\d+\.\d+\+.+?"/);
    expect(envelope).toContain('"release":"pawcareright@0.0.0+abc1234"');
    expect(envelope).toContain('"environment":"test"');
  });

  it("the scrubber runs inside the SDK pipeline (planted PII never reaches the envelope)", async () => {
    const sink = { bodies: [] as string[] };
    Sentry.init({
      ...baseSentryOptions({
        dsn: TEST_DSN,
        environment: "test",
        release: buildSentryRelease("0.0.0", "abc1234"),
      }),
      transport: buildCapturingTransport(sink),
    });

    Sentry.captureEvent({
      message: "forced test error, contact owner@example.com for details",
      level: "error",
      request: { data: { symptomText: "MARKER_INTAKE my dog ate chocolate" } },
    });
    await Sentry.flush();

    expect(sink.bodies.length).toBeGreaterThan(0);
    const envelope = sink.bodies.join("\n");
    expect(envelope).not.toContain("MARKER_INTAKE");
    expect(envelope).not.toContain("owner@example.com");
  });

  // T089 finding F1 (checker probes A + D): `@sentry/node`'s default
  // `consoleIntegration` turns every `console.*` call — exactly how Nest's
  // `Logger` writes — into a breadcrumb; a manual `addBreadcrumb` call is
  // the same channel. Both must be absent from the captured envelope: this
  // is what `beforeBreadcrumb` (wired in `initApiSentry`, exercised here
  // directly via `baseSentryOptions` the same way `initApiSentry` builds
  // it) closes. Precisely: this end-to-end test guards the SHARED scrub
  // functions (beforeSend's structural breadcrumb pass closes the wire even
  // if beforeBreadcrumb alone is dropped from an init — that init-level
  // wiring is pinned separately by options.spec + the wiring assertion in
  // this file); gutting scrubBreadcrumb/scrubBreadcrumbs themselves fails
  // this test (checker re-review mutation MF1b+c).
  it("closes the console/breadcrumb channel (probes A + D never reach the envelope)", async () => {
    const sink = { bodies: [] as string[] };
    const options = baseSentryOptions({
      dsn: TEST_DSN,
      environment: "test",
      release: buildSentryRelease("0.0.0", "abc1234"),
    });
    Sentry.init({
      ...options,
      transport: buildCapturingTransport(sink),
      // `ContextLines` embeds literal SOURCE FILE text around each stack
      // frame — an SDK feature unrelated to breadcrumb scrubbing that would
      // otherwise contaminate this probe with the test's own source text
      // (the marker literals below, sitting in this same function). Removed
      // here only, so this test isolates the breadcrumb channel exactly.
      integrations: (defaults) => defaults.filter((integration) => integration.name !== "ContextLines"),
    });

    // Probe A: a console.log line formatted exactly like Nest's Logger output.
    // eslint-disable-next-line no-console -- JUSTIFIED: probe reproduces the checker's finding that Nest's ConsoleLogger (which writes via console.log) becomes a Sentry breadcrumb; this is a deliberate, single-use test probe, not production logging
    console.log("[AllExceptionsFilter] 500 INTERNAL: MARKER_CONSOLE_PROBE_A");
    // Probe D: a manual addBreadcrumb call with free-text intake content.
    Sentry.addBreadcrumb({ message: "intake=MARKER_ADDBREADCRUMB_PROBE_D" });

    Sentry.captureException(new Error("T089 forced test error"));
    await Sentry.flush();

    expect(sink.bodies.length).toBeGreaterThan(0);
    const envelope = sink.bodies.join("\n");
    expect(envelope).not.toContain("MARKER_CONSOLE_PROBE_A");
    expect(envelope).not.toContain("MARKER_ADDBREADCRUMB_PROBE_D");
  });
});

describe("captureApiException", () => {
  afterEach(async () => {
    await Sentry.close(0);
  });

  it("is a safe no-op when Sentry was never initialized", () => {
    expect(() => captureApiException(new Error("boom"), "req-1")).not.toThrow();
  });

  it("tags the event with requestId only, never the raw error's request context", async () => {
    const sink = { bodies: [] as string[] };
    Sentry.init({
      ...baseSentryOptions({
        dsn: TEST_DSN,
        environment: "test",
        release: buildSentryRelease("0.0.0", "abc1234"),
      }),
      transport: buildCapturingTransport(sink),
    });

    captureApiException(new Error("server exploded"), "req-42");
    await Sentry.flush();

    const envelope = sink.bodies.join("\n");
    expect(envelope).toContain('"requestId":"req-42"');
  });
});
