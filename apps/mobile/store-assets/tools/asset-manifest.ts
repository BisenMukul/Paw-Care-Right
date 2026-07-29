/**
 * T100 plan step 1 -- the single source of truth for every generated app
 * icon / splash / store-listing PNG. Pure data, no I/O: `generate-assets.ts`
 * walks this array to render + write every file; the manifest specs
 * (`store-assets-manifest.test.ts`) assert every real on-disk asset against
 * these exact dimensions/alpha/byte-cap values (§5.1 of the plan is
 * binding -- do not let this drift from that table).
 *
 * Paths are repo-relative (from the monorepo root), matching how
 * `store-assets-doc.test.ts` and the manifest spec both resolve them.
 */

export type AssetRole =
  | "app-icon"
  | "adaptive-icon"
  | "splash-mark"
  | "favicon"
  | "store-icon"
  | "feature-graphic"
  | "android-legacy-icon"
  | "splash-preview";

/**
 * Render parameters consumed by `raster.ts`'s `renderMark` (via
 * `generate-assets.ts`). Kept as manifest data (not derived at generation
 * time) so one table drives both "what the file must look like on disk" and
 * "how it was drawn" -- there is exactly one place to change either.
 */
export interface AssetRenderSpec {
  /** Hex fill for the canvas, or `null` for a fully transparent background. */
  readonly background: string | null;
  /** Hex for the paw mark itself. */
  readonly mark: string;
  /** Fraction (0-1] of the canvas's shorter side the mark occupies. */
  readonly markScale: number;
  /** Corner-radius ratio applied to a non-null background (0 = square). */
  readonly cornerRadiusRatio: number;
}

export interface AssetManifestEntry {
  readonly id: string;
  /** Repo-relative path (from the monorepo root), forward-slash separated. */
  readonly path: string;
  readonly width: number;
  readonly height: number;
  /** Whether the PNG must carry an alpha channel (colour type 6 vs 2). */
  readonly alpha: boolean;
  readonly maxBytes: number;
  readonly role: AssetRole;
  /** Human-readable store/Expo rule this asset must satisfy (§5.1). */
  readonly spec: string;
  readonly render: AssetRenderSpec;
}

const KB = 1024;

// Brand-field / mark colours are declared once in `raster.ts` (`BRAND_PALETTE`,
// sourced from `packages/config/tailwind-preset.mjs`, F9) -- this manifest
// only refers to them by hex literal to stay pure data with no import cycle
// back into `raster.ts`. `store-assets-art.test.ts` cross-checks these same
// literals against the preset file directly.
const FIELD = "#1f6350";
const FIELD_DARK = "#0c140f";
const MARK = "#F4EFE6";
const MARK_DARK = "#E7E0D3";

export const ASSET_MANIFEST: readonly AssetManifestEntry[] = [
  // ---- app assets referenced by app.config.js ----
  {
    id: "app-icon",
    path: "apps/mobile/assets/icon.png",
    width: 1024,
    height: 1024,
    alpha: false,
    maxBytes: 250 * KB,
    role: "app-icon",
    spec: "iOS marketing icon must have no alpha channel",
    render: { background: FIELD, mark: MARK, markScale: 0.62, cornerRadiusRatio: 0 },
  },
  {
    id: "adaptive-icon",
    path: "apps/mobile/assets/adaptive-icon.png",
    width: 1024,
    height: 1024,
    alpha: true,
    maxBytes: 250 * KB,
    role: "adaptive-icon",
    spec: "Android adaptive foreground; art inside centre 66% safe zone",
    render: { background: null, mark: MARK, markScale: 0.6, cornerRadiusRatio: 0 },
  },
  {
    id: "splash-icon-light",
    path: "apps/mobile/assets/splash-icon.png",
    width: 1024,
    height: 1024,
    alpha: true,
    maxBytes: 250 * KB,
    role: "splash-mark",
    spec: "splash mark, light scheme",
    render: { background: null, mark: FIELD, markScale: 0.5, cornerRadiusRatio: 0 },
  },
  {
    id: "splash-icon-dark",
    path: "apps/mobile/assets/splash-icon-dark.png",
    width: 1024,
    height: 1024,
    alpha: true,
    maxBytes: 250 * KB,
    role: "splash-mark",
    spec: "splash mark, dark scheme",
    render: { background: null, mark: MARK_DARK, markScale: 0.5, cornerRadiusRatio: 0 },
  },
  {
    id: "favicon",
    path: "apps/mobile/assets/favicon.png",
    width: 48,
    height: 48,
    alpha: true,
    maxBytes: 20 * KB,
    role: "favicon",
    spec: "web favicon",
    render: { background: null, mark: FIELD, markScale: 0.7, cornerRadiusRatio: 0 },
  },

  // ---- store-listing icons ----
  {
    id: "store-icon-ios",
    path: "apps/mobile/store-assets/icons/app-store-icon-1024.png",
    width: 1024,
    height: 1024,
    alpha: false,
    maxBytes: 250 * KB,
    role: "store-icon",
    spec: "App Store listing icon",
    render: { background: FIELD, mark: MARK, markScale: 0.62, cornerRadiusRatio: 0 },
  },
  {
    id: "store-icon-android",
    path: "apps/mobile/store-assets/icons/play-store-icon-512.png",
    width: 512,
    height: 512,
    alpha: true,
    maxBytes: 120 * KB,
    role: "store-icon",
    spec: "Play 32-bit PNG icon",
    render: { background: FIELD, mark: MARK, markScale: 0.62, cornerRadiusRatio: 0 },
  },
  {
    id: "play-feature-graphic",
    path: "apps/mobile/store-assets/icons/play-feature-graphic-1024x500.png",
    width: 1024,
    height: 500,
    alpha: false,
    maxBytes: 250 * KB,
    role: "feature-graphic",
    spec: "Play feature graphic",
    render: { background: FIELD_DARK, mark: MARK, markScale: 0.7, cornerRadiusRatio: 0 },
  },

  // ---- Android legacy launcher density set ("all densities") ----
  {
    id: "android-legacy-mdpi",
    path: "apps/mobile/store-assets/icons/android-legacy/ic_launcher-mdpi-48.png",
    width: 48,
    height: 48,
    alpha: false,
    maxBytes: 40 * KB,
    role: "android-legacy-icon",
    spec: "launcher density reference set (mdpi)",
    render: { background: FIELD, mark: MARK, markScale: 0.62, cornerRadiusRatio: 0 },
  },
  {
    id: "android-legacy-hdpi",
    path: "apps/mobile/store-assets/icons/android-legacy/ic_launcher-hdpi-72.png",
    width: 72,
    height: 72,
    alpha: false,
    maxBytes: 40 * KB,
    role: "android-legacy-icon",
    spec: "launcher density reference set (hdpi)",
    render: { background: FIELD, mark: MARK, markScale: 0.62, cornerRadiusRatio: 0 },
  },
  {
    id: "android-legacy-xhdpi",
    path: "apps/mobile/store-assets/icons/android-legacy/ic_launcher-xhdpi-96.png",
    width: 96,
    height: 96,
    alpha: false,
    maxBytes: 40 * KB,
    role: "android-legacy-icon",
    spec: "launcher density reference set (xhdpi)",
    render: { background: FIELD, mark: MARK, markScale: 0.62, cornerRadiusRatio: 0 },
  },
  {
    id: "android-legacy-xxhdpi",
    path: "apps/mobile/store-assets/icons/android-legacy/ic_launcher-xxhdpi-144.png",
    width: 144,
    height: 144,
    alpha: false,
    maxBytes: 40 * KB,
    role: "android-legacy-icon",
    spec: "launcher density reference set (xxhdpi)",
    render: { background: FIELD, mark: MARK, markScale: 0.62, cornerRadiusRatio: 0 },
  },
  {
    id: "android-legacy-xxxhdpi",
    path: "apps/mobile/store-assets/icons/android-legacy/ic_launcher-xxxhdpi-192.png",
    width: 192,
    height: 192,
    alpha: false,
    maxBytes: 40 * KB,
    role: "android-legacy-icon",
    spec: "launcher density reference set (xxxhdpi)",
    render: { background: FIELD, mark: MARK, markScale: 0.62, cornerRadiusRatio: 0 },
  },

  // ---- splash review previews (full-device, non-interactive) ----
  {
    id: "splash-preview-light",
    path: "apps/mobile/store-assets/splash/splash-preview-light-1290x2796.png",
    width: 1290,
    height: 2796,
    alpha: false,
    maxBytes: 400 * KB,
    role: "splash-preview",
    spec: "splash review preview (light)",
    render: { background: "#F4EFE6", mark: FIELD, markScale: 0.32, cornerRadiusRatio: 0 },
  },
  {
    id: "splash-preview-dark",
    path: "apps/mobile/store-assets/splash/splash-preview-dark-1290x2796.png",
    width: 1290,
    height: 2796,
    alpha: false,
    maxBytes: 400 * KB,
    role: "splash-preview",
    spec: "splash review preview (dark)",
    render: { background: FIELD_DARK, mark: MARK_DARK, markScale: 0.32, cornerRadiusRatio: 0 },
  },
] as const;

/** Manifest ids that `apps/mobile/app.config.js` references directly. */
export const APP_CONFIG_ASSET_IDS: readonly string[] = ["app-icon", "adaptive-icon", "favicon"] as const;
