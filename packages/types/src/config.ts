import { z } from "zod";

/**
 * Remote app-config schema (T074 plan decision 4; grown by T079 plan
 * decision 6; grown by T106 for feature kill switches). Server-sent fields:
 * the paywall A/B variant ID, the minimum-supported-client-version gate, the
 * bundled hotline-pack version tag, and the `features` kill-switch flags.
 * All paywall COPY stays client-side in `strings.ts` (plan decision 5) — the
 * server never sends arbitrary prose, which keeps this surface trivially
 * safe to review (CLAUDE.md §7) and i18n-ready (T110). No Nest/DB imports —
 * this file is consumed by both `apps/api` (response typing) and
 * `apps/mobile` (client parsing).
 *
 * T106: `features` are booleans only, never prose (§7 review surface) —
 * a flag can only turn a surface on/off, it can never carry copy.
 *
 * T114: `criticalOtaVersion` names the EAS `updateId` that MUST be running;
 * `null` = no critical update. It is a machine id, never prose (§7 review
 * surface) — belt-and-braces mirror of the `[critical]` publish-message
 * marker for clients that fetched before the flag (docs/OTA_UPDATES.md §3).
 *
 * T115: `minAppVersion`/`recommendedAppVersion` are per-platform binary
 * version gates (`"0.0.0"` = no gate, `NO_GATE_VERSION`) driving the
 * blocking upgrade screen / dismissible recommended-update banner. Also
 * introduces `appConfigClientSchema` -- the CLIENT parse path, resolving
 * T114 checker Finding 1 (docs/OTA_UPDATES.md §5.4): `appConfigResponseSchema`
 * stays `.strict()` as the SERVER contract (the API must never ship an
 * undocumented field), but the client must never let an old bundle's parse
 * reject a body just because the server grew a field it doesn't know about
 * yet -- that would strand the `features` kill switches. Go-forward rule
 * for T116+: server changes are additive-only (§5.1), the client schema is
 * `.strip()`-mode at every level, and every field T115+ introduces gets a
 * client-side `.default()` -- "backward-compatible by construction."
 */
export const PAYWALL_VARIANTS = ["A", "B"] as const;
export const paywallVariantSchema = z.enum(PAYWALL_VARIANTS);
export type PaywallVariant = z.infer<typeof paywallVariantSchema>;

export const FEATURE_KEYS = ["checks", "chat", "paywall"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const featureFlagsSchema = z
  .object({
    checks: z.boolean(),
    chat: z.boolean(),
    paywall: z.boolean(),
  })
  .strict();
export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

/** T115: the sentinel meaning "no gate" -- identical convention to `minSupportedVersion`/`MIN_SUPPORTED_VERSION`'s existing `"0.0.0"` default. */
export const NO_GATE_VERSION = "0.0.0";

export const platformAppVersionsSchema = z.object({ ios: z.string(), android: z.string() }).strict();
export type PlatformAppVersions = z.infer<typeof platformAppVersionsSchema>;

// SERVER CONTRACT — stays `.strict()`: the API must never send an
// undocumented field (T115; see the file header comment for the go-forward
// rule and why the CLIENT path below is intentionally more tolerant).
export const appConfigResponseSchema = z
  .object({
    paywall: z.object({ variant: paywallVariantSchema }),
    minSupportedVersion: z.string(),
    hotlinePackVersion: z.number().int().nonnegative(),
    features: featureFlagsSchema,
    criticalOtaVersion: z.string().nullable(),
    minAppVersion: platformAppVersionsSchema, // T115
    recommendedAppVersion: platformAppVersionsSchema, // T115
  })
  .strict();
export type AppConfigResponse = z.infer<typeof appConfigResponseSchema>;

// CLIENT PARSE PATH (docs/OTA_UPDATES.md §5.4; T114 checker Finding 1):
// tolerant of unknown/future keys at BOTH levels, with defaults for the
// fields T115 introduces, so an old bundle can never lose the `features`
// kill switches just because a newer server grew a field. `.strip()` (not
// `.passthrough()`): unknown keys are DROPPED, so nothing unvalidated ever
// reaches `AppConfig` or the MMKV cache. Function-form `.default(() => …)`
// so the fallback object is never a shared mutable reference.
export const appConfigClientSchema = appConfigResponseSchema
  .extend({
    features: featureFlagsSchema.strip(),
    minAppVersion: platformAppVersionsSchema
      .strip()
      .default(() => ({ ios: NO_GATE_VERSION, android: NO_GATE_VERSION })),
    recommendedAppVersion: platformAppVersionsSchema
      .strip()
      .default(() => ({ ios: NO_GATE_VERSION, android: NO_GATE_VERSION })),
  })
  .strip();
export type AppConfigClient = z.infer<typeof appConfigClientSchema>;
