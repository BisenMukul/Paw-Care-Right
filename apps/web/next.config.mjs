import { withSentryConfig } from "@sentry/nextjs";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@bombaypetcompany/config"],
};

// T089 (plan D7/R6): source-map upload is a build-time, best-effort step —
// it activates ONLY when SENTRY_AUTH_TOKEN is present (the SDK's own
// `authToken` default already reads that env var), so `pnpm --filter web
// build` stays green with zero Sentry secrets set (verified: step 4 of the
// plan). `org`/`project` fall back to the §1a `bombaypetcompany` slug so a
// real deploy only has to set the auth token + org/project overrides.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "bombaypetcompany",
  project: process.env.SENTRY_PROJECT ?? "bombaypetcompany-web",
  silent: !process.env.CI,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
