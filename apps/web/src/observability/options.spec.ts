import { scrubSentryEvent } from "@pawcareright/analytics";

import { webSentryOptions } from "./options";

describe("webSentryOptions", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function clearSentryEnv(): void {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
    delete process.env.NEXT_PUBLIC_GIT_SHA;
    delete process.env.NEXT_PUBLIC_APP_VERSION;
  }

  it("is disabled and stub-safe when no DSN env is set", () => {
    clearSentryEnv();

    const options = webSentryOptions();

    expect(options.dsn).toBe("");
    expect(options.enabled).toBe(false);
  });

  it("is enabled with a pinned release/environment when a DSN is set", () => {
    clearSentryEnv();
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://pub@o0.ingest.example/0";
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = "staging";
    process.env.NEXT_PUBLIC_GIT_SHA = "deadbeef";
    process.env.NEXT_PUBLIC_APP_VERSION = "1.2.3";

    const options = webSentryOptions();

    expect(options.enabled).toBe(true);
    expect(options.dsn).toBe("https://pub@o0.ingest.example/0");
    expect(options.environment).toBe("staging");
    expect(options.release).toBe("pawcareright@1.2.3+deadbeef");
  });

  it("pins beforeSend to the shared scrubber and sendDefaultPii to false", () => {
    clearSentryEnv();

    const options = webSentryOptions();

    expect(options.beforeSend).toBe(scrubSentryEvent);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
  });
});
