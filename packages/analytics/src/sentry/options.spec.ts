import { scrubBreadcrumb, scrubSentryEvent } from "./scrub";
import { baseSentryOptions, buildSentryRelease } from "./options";

describe("buildSentryRelease", () => {
  it("builds bombaypetcompany@{version}+{buildId} (CLAUDE §1a shape)", () => {
    expect(buildSentryRelease("1.2.3", "abc")).toBe("bombaypetcompany@1.2.3+abc");
  });

  it("falls back to 0.0.0 when version is empty", () => {
    expect(buildSentryRelease("", "abc")).toBe("bombaypetcompany@0.0.0+abc");
  });

  it("falls back to dev when buildId is empty", () => {
    expect(buildSentryRelease("1.2.3", "")).toBe("bombaypetcompany@1.2.3+dev");
  });

  it("falls back on whitespace-only inputs too", () => {
    expect(buildSentryRelease("   ", "   ")).toBe("bombaypetcompany@0.0.0+dev");
  });
});

describe("baseSentryOptions", () => {
  it("pins beforeSend to the shared scrubber", () => {
    const options = baseSentryOptions({
      dsn: "https://pub@o0.ingest.example/0",
      environment: "test",
      release: "bombaypetcompany@0.0.0+abc",
    });

    expect(options.beforeSend).toBe(scrubSentryEvent);
  });

  // T089 finding F1: beforeBreadcrumb must be pinned too, or the
  // console/manual-breadcrumb free-text channel reopens.
  it("pins beforeBreadcrumb to the shared breadcrumb scrubber", () => {
    const options = baseSentryOptions({
      dsn: "https://pub@o0.ingest.example/0",
      environment: "test",
      release: "bombaypetcompany@0.0.0+abc",
    });

    expect(options.beforeBreadcrumb).toBe(scrubBreadcrumb);
  });

  it("pins sendDefaultPii to false and tracesSampleRate to 0", () => {
    const options = baseSentryOptions({
      dsn: "https://pub@o0.ingest.example/0",
      environment: "test",
      release: "bombaypetcompany@0.0.0+abc",
    });

    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
  });

  it("is enabled only when dsn is non-empty (stub-safe by default)", () => {
    const enabled = baseSentryOptions({
      dsn: "https://pub@o0.ingest.example/0",
      environment: "test",
      release: "bombaypetcompany@0.0.0+abc",
    });
    const disabled = baseSentryOptions({ dsn: "", environment: "test", release: "bombaypetcompany@0.0.0+abc" });

    expect(enabled.enabled).toBe(true);
    expect(disabled.enabled).toBe(false);
  });

  it("passes release and environment through unchanged", () => {
    const options = baseSentryOptions({
      dsn: "",
      environment: "staging",
      release: "bombaypetcompany@1.2.3+deadbeef",
    });

    expect(options.release).toBe("bombaypetcompany@1.2.3+deadbeef");
    expect(options.environment).toBe("staging");
  });
});
