// T089 — mobile Sentry init + capture helper (plan D2/D5).
//
// D5 (Expo Go / jest safety): `@sentry/react-native` is a native module —
// it is lazy-`require`d inside `initMobileSentry()`, behind the DSN check
// AND a try/catch, exactly like the `react-native-mmkv` precedent in
// `src/api/query.ts`/`src/storage/safe-storage.ts`. This means startup
// never crashes when the native binding is absent (Expo Go, this repo's
// jest environment), and jest never needs to load the native module at
// all when SENTRY_DSN is empty (the default).
//
// D2: the release's `+{buildId}` slot is filled with the build-time git sha
// (`EXPO_PUBLIC_GIT_SHA`, default `"dev"`) because `expo-updates` does not
// exist yet (T113) — T117 owns swapping this slot to `Updates.updateId` per
// OTA_UPDATES §7. The §1a release SHAPE (`pawcareright@{version}+{buildId}`)
// is preserved unchanged.
import { baseSentryOptions, buildSentryRelease, type SentryEventLike } from "@pawcareright/analytics";

import { getAppVersion, getConfig } from "../config";

// Type-only reference to the native module's shape (no runtime import) —
// the actual module is lazy-`require`d inside `initMobileSentry` below.
type SentryModule = typeof import("@sentry/react-native");

let sentryModule: SentryModule | undefined;

/**
 * Stub-safe by default (plan D5, POSTHOG pattern): an empty `sentryDsn`
 * (the default) means the native module is never `require`d and `init` is
 * never called — Expo Go and jest never touch the native binding.
 */
export function initMobileSentry(): void {
  // T089 finding F4: `getConfig()` lives INSIDE the try block (not before
  // it) so the whole function body is genuinely try/catch-wrapped end to
  // end — the call site in `app/_layout.tsx` can rely on that guarantee
  // literally, not just "realistically can't throw".
  try {
    const config = getConfig();

    if (config.sentryDsn === "") {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: lazy runtime require so a missing native Sentry binding (Expo Go) never crashes startup (D5, MMKV precedent)
    const Sentry = require("@sentry/react-native") as SentryModule;

    const options = baseSentryOptions({
      dsn: config.sentryDsn,
      environment: __DEV__ ? "development" : "production",
      release: buildSentryRelease(getAppVersion(), config.gitSha),
    });

    type NativeBeforeSend = NonNullable<Parameters<SentryModule["init"]>[0]["beforeSend"]>;
    type NativeBeforeBreadcrumb = NonNullable<Parameters<SentryModule["init"]>[0]["beforeBreadcrumb"]>;
    // Adapter casts at this single call site only (plan R1 / interfaces
    // note): the shared scrubber/breadcrumb-scrubber are typed against
    // structural types so `packages/analytics` stays free of any
    // `@sentry/*` import.
    const beforeSend: NativeBeforeSend = (event) =>
      options.beforeSend(event as unknown as SentryEventLike) as unknown as ReturnType<NativeBeforeSend>;
    // T089 finding F1: closes the console/manual-breadcrumb free-text
    // channel that `beforeSend` alone cannot fully cover.
    const beforeBreadcrumb: NativeBeforeBreadcrumb = (breadcrumb) =>
      options.beforeBreadcrumb(
        breadcrumb as unknown as Parameters<typeof options.beforeBreadcrumb>[0],
      ) as unknown as ReturnType<NativeBeforeBreadcrumb>;

    Sentry.init({ ...options, beforeSend, beforeBreadcrumb });
    sentryModule = Sentry;
  } catch {
    sentryModule = undefined;
  }
}

/**
 * Reports `error` to Sentry, optionally tagged with `context` (a plain
 * object — never the raw component tree/props). Safe no-op when Sentry was
 * never initialized (empty DSN, or the native module failed to load).
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryModule) {
    return;
  }

  try {
    const sentry = sentryModule;
    sentry.withScope((scope) => {
      if (context) {
        scope.setContext("error_context", context);
      }
      sentry.captureException(error);
    });
  } catch {
    // Never let observability break the app it's trying to diagnose.
  }
}
