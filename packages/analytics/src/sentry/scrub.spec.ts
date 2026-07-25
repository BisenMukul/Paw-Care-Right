import { REDACTED, scrubBreadcrumb, scrubSentryEvent, type Breadcrumb, type SentryEventLike } from "./scrub";

describe("scrubSentryEvent", () => {
  it("drops the request body wholesale (intake text / chat content never leaks)", () => {
    const event: SentryEventLike = {
      request: { data: { symptomText: "MARKER_INTAKE my dog ate chocolate" } },
    };

    const result = scrubSentryEvent(event);

    expect(JSON.stringify(result)).not.toContain("MARKER_INTAKE");
    expect(result?.request?.data).toBeUndefined();
  });

  it("reduces headers to the allowlist", () => {
    const event: SentryEventLike = {
      request: {
        headers: {
          host: "api.pawcareright.app",
          authorization: "Bearer super-secret-token",
          cookie: "session=abc123",
          "x-api-key": "leak-me",
          "user-agent": "jest",
        },
      },
    };

    const result = scrubSentryEvent(event);

    expect(result?.request?.headers).toEqual({
      host: "api.pawcareright.app",
      "user-agent": "jest",
    });
  });

  it("strips query strings from url and deletes query_string", () => {
    const event: SentryEventLike = {
      request: {
        url: "https://api.pawcareright.app/v1/auth/verify?token=abc&otp=123456",
        query_string: "token=abc&otp=123456",
      },
    };

    const result = scrubSentryEvent(event);

    expect(result?.request?.url).toBe("https://api.pawcareright.app/v1/auth/verify");
    expect(result?.request?.query_string).toBeUndefined();
  });

  // T089 finding F3 (checker probe C): `request` is an ALLOWLIST
  // ({url, method, headers} only) — any unenumerated SDK field, including a
  // future one this scrubber was never updated for, is dropped by omission
  // rather than requiring a new deny-list entry every time the SDK adds one.
  it("drops an unknown request field (probe C: request.env.REMOTE_ADDR, a client IP)", () => {
    const event: SentryEventLike = {
      request: {
        method: "POST",
        url: "https://api.pawcareright.app/v1/checks",
        env: { REMOTE_ADDR: "203.0.113.9" },
      },
    };

    const result = scrubSentryEvent(event);

    expect(JSON.stringify(result)).not.toContain("203.0.113.9");
    expect(result?.request?.env).toBeUndefined();
    expect(result?.request).toEqual({
      method: "POST",
      url: "https://api.pawcareright.app/v1/checks",
    });
  });

  it("reduces user to id only", () => {
    const event: SentryEventLike = {
      user: { id: "user-1", email: "owner@example.com", ip_address: "1.2.3.4", username: "owner" },
    };

    const result = scrubSentryEvent(event);

    expect(result?.user).toEqual({ id: "user-1" });
  });

  it("reduces breadcrumb data to the allowlist and truncates breadcrumb urls at ?", () => {
    const event: SentryEventLike = {
      breadcrumbs: [
        {
          category: "http",
          data: {
            method: "POST",
            status_code: 500,
            url: "https://api.pawcareright.app/v1/checks?token=abc",
            authorization: "Bearer leak",
          },
        },
      ],
    };

    const result = scrubSentryEvent(event);

    expect(result?.breadcrumbs?.[0]?.data).toEqual({
      method: "POST",
      status_code: 500,
      url: "https://api.pawcareright.app/v1/checks",
    });
  });

  it("redacts an email address in the top-level message", () => {
    const event: SentryEventLike = { message: "contact owner@example.com for details" };

    const result = scrubSentryEvent(event);

    expect(JSON.stringify(result)).not.toContain("owner@example.com");
    expect(result?.message).toBe(`contact ${REDACTED} for details`);
  });

  it("redacts an email address inside an exception value", () => {
    const event: SentryEventLike = {
      exception: { values: [{ type: "Error", value: "failed for owner@example.com" }] },
    };

    const result = scrubSentryEvent(event);

    expect(JSON.stringify(result)).not.toContain("owner@example.com");
  });

  // T089 finding F1: `message` is dropped WHOLESALE from every breadcrumb
  // (not merely pattern-redacted) — it is an arbitrary-free-text field that
  // a pattern-only redactor cannot fully cover. This test uses a plain,
  // non-pattern marker (no email/token/JWT shape) precisely to prove the
  // drop is structural, not incidentally caught by `redactString`.
  it("drops breadcrumb message wholesale, closing the arbitrary-free-text channel", () => {
    const event: SentryEventLike = {
      breadcrumbs: [{ category: "auth", message: "sent Bearer abc.def-ghi123 MARKER_PLAIN_TEXT" }],
    };

    const result = scrubSentryEvent(event);

    expect(JSON.stringify(result)).not.toContain("abc.def-ghi123");
    expect(JSON.stringify(result)).not.toContain("MARKER_PLAIN_TEXT");
    expect(result?.breadcrumbs?.[0]?.message).toBeUndefined();
  });

  // Reproduces the checker's probe A: `@sentry/node`'s default
  // `consoleIntegration` emits `category: "console"` breadcrumbs whose
  // `message` is the raw formatted console line and whose `data.arguments`
  // is the raw argument array — dropped entirely (not just `message`).
  it("drops console-category breadcrumbs entirely (probe A: consoleIntegration output)", () => {
    const event: SentryEventLike = {
      breadcrumbs: [
        {
          category: "console",
          level: "log",
          message: "[AllExceptionsFilter] 500 INTERNAL: MARKER_CONSOLE_LOG",
          data: { arguments: ["MARKER_CONSOLE_LOG"], logger: "console" },
        },
      ],
    };

    const result = scrubSentryEvent(event);

    expect(JSON.stringify(result)).not.toContain("MARKER_CONSOLE_LOG");
    expect(result?.breadcrumbs).toEqual([]);
  });

  // Reproduces the checker's probe D: a manual `addBreadcrumb({ message })`
  // call with no special category — the wholesale `message` drop above
  // catches this too, since it does not depend on category.
  it("drops the message of a manually-added breadcrumb (probe D: addBreadcrumb)", () => {
    const event: SentryEventLike = {
      breadcrumbs: [{ message: "intake=MARKER_MANUAL_BREADCRUMB" }],
    };

    const result = scrubSentryEvent(event);

    expect(JSON.stringify(result)).not.toContain("MARKER_MANUAL_BREADCRUMB");
  });

  it("redacts a JWT-shaped string inside extra", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const event: SentryEventLike = { extra: { token: jwt } };

    const result = scrubSentryEvent(event);

    expect(JSON.stringify(result)).not.toContain(jwt);
  });

  it("redacts an email address inside contexts", () => {
    const event: SentryEventLike = { contexts: { app: { note: "owner@example.com reported" } } };

    const result = scrubSentryEvent(event);

    expect(JSON.stringify(result)).not.toContain("owner@example.com");
  });

  it("keeps stacktraces, event_id, level, tags, release, environment intact", () => {
    const event: SentryEventLike = {
      event_id: "evt-1",
      level: "error",
      release: "pawcareright@0.0.0+abc1234",
      environment: "production",
      tags: { requestId: "req-1" },
      exception: {
        values: [
          {
            type: "Error",
            value: "boom",
            stacktrace: { frames: [{ filename: "app.ts", function: "handler", lineno: 42 }] },
          },
        ],
      },
    };

    const result = scrubSentryEvent(event);

    expect(result?.event_id).toBe("evt-1");
    expect(result?.level).toBe("error");
    expect(result?.release).toBe("pawcareright@0.0.0+abc1234");
    expect(result?.environment).toBe("production");
    expect(result?.tags).toEqual({ requestId: "req-1" });
    expect(result?.exception).toEqual({
      values: [
        {
          type: "Error",
          value: "boom",
          stacktrace: { frames: [{ filename: "app.ts", function: "handler", lineno: 42 }] },
        },
      ],
    });
  });

  it("returns a new object; the input is not mutated", () => {
    const event: SentryEventLike = {
      request: { data: { symptomText: "leak me" }, headers: { host: "h", authorization: "b" } },
      user: { id: "u1", email: "owner@example.com" },
    };
    const before = JSON.parse(JSON.stringify(event)) as SentryEventLike;

    const result = scrubSentryEvent(event);

    expect(result).not.toBe(event);
    expect(event).toEqual(before);
  });

  it("returns null (drops the event) on a pathological input", () => {
    const evil: SentryEventLike = {};
    Object.defineProperty(evil, "message", {
      enumerable: true,
      get(): string {
        throw new Error("boom");
      },
    });

    expect(scrubSentryEvent(evil)).toBeNull();
  });

  it("handles cyclic objects without hanging", () => {
    const cyclic: Record<string, unknown> = { message: "hi" };
    cyclic.self = cyclic;

    const result = scrubSentryEvent(cyclic as SentryEventLike);

    expect(result).not.toBeNull();
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.stringify(result)).toContain("[Circular]");
  });
});

// T089 finding F1: `scrubBreadcrumb` is the SDK's `beforeBreadcrumb` hook
// (wired via `baseSentryOptions`) — it runs on EVERY breadcrumb the moment
// it is recorded, regardless of origin (default `consoleIntegration` or a
// manual `addBreadcrumb` call), closing the channel at the source rather
// than relying solely on the later event-level pass in `scrubSentryEvent`.
describe("scrubBreadcrumb (beforeBreadcrumb hook)", () => {
  it("drops console-category breadcrumbs entirely", () => {
    expect(
      scrubBreadcrumb({
        category: "console",
        message: "MARKER_CONSOLE",
        data: { arguments: ["MARKER_CONSOLE"] },
      }),
    ).toBeNull();
  });

  it("drops message wholesale from a non-console breadcrumb but keeps category and allowlisted data", () => {
    const result = scrubBreadcrumb({
      category: "http",
      message: "MARKER_PLAIN",
      data: { method: "GET", status_code: 200, authorization: "Bearer leak" },
    });

    expect(result).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain("MARKER_PLAIN");
    expect(result?.message).toBeUndefined();
    expect(result?.category).toBe("http");
    expect(result?.data).toEqual({ method: "GET", status_code: 200 });
  });

  it("never throws on a pathological breadcrumb (fails closed by dropping it)", () => {
    const evil: Record<string, unknown> = {};
    Object.defineProperty(evil, "category", {
      enumerable: true,
      get(): string {
        throw new Error("boom");
      },
    });

    let result: unknown;
    expect(() => {
      result = scrubBreadcrumb(evil as Breadcrumb);
    }).not.toThrow();
    expect(result).toBeNull();
  });
});
