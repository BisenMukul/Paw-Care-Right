import { readOtaInfo } from "../observability/ota-info";

/**
 * T114: the pure OTA update-check/fetch/critical-decision cycle
 * (docs/OTA_UPDATES.md §3). Never throws, never calls `reloadAsync` — the
 * deferral guard and the user's tap live entirely in `use-update-flow.ts`.
 * Every uncertainty (disabled, missing loader, timeout, check/fetch error)
 * resolves toward the silent, non-interrupting path (CLAUDE.md §7).
 */

/** Cold-start check budget (§3: "non-blocking, 3s budget"). */
export const COLD_START_CHECK_BUDGET_MS = 3000;

/**
 * Narrow shape of the `expo-updates` module this file calls. All-optional,
 * mirroring `UpdatesNative` (T113 idiom, `observability/ota-info.ts`), so a
 * partial test fixture stays a valid `UpdatesUpdateApi`.
 */
export interface UpdatesUpdateApi {
  isEnabled?: boolean;
  updateId?: string | null;
  checkForUpdateAsync?: () => Promise<{ isAvailable?: boolean; manifest?: unknown }>;
  fetchUpdateAsync?: () => Promise<{ isNew?: boolean; manifest?: unknown }>;
  reloadAsync?: () => Promise<void>;
}

export type UpdatesApiLoader = () => UpdatesUpdateApi | null;

/**
 * Lazy runtime require of `expo-updates`, mirroring T113's `defaultLoader`
 * (`observability/ota-info.ts`): the native module cannot load in Expo Go /
 * the jest container, so it is never imported at module top level. A failed
 * `require` resolves to `null`.
 */
export const defaultUpdatesApiLoader: UpdatesApiLoader = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: lazy runtime require so a missing native expo-updates binding (Expo Go / jest) falls back instead of crashing at module load
    const mod = require("expo-updates");
    return (mod ?? null) as UpdatesUpdateApi | null;
  } catch {
    return null;
  }
};

/** Candidate manifest paths that may carry the `[critical]` publish-message marker (D2 — no single documented field). */
function candidateMarkerStrings(manifest: unknown): string[] {
  if (typeof manifest !== "object" || manifest === null) {
    return [];
  }

  const values: string[] = [];
  try {
    const asRecord = manifest as Record<string, unknown>;
    const extra = asRecord.extra;
    const metadata = asRecord.metadata;

    if (typeof extra === "object" && extra !== null) {
      const extraRecord = extra as Record<string, unknown>;
      if (typeof extraRecord.updateMessage === "string") {
        values.push(extraRecord.updateMessage);
      }

      const expoClient = extraRecord.expoClient;
      if (typeof expoClient === "object" && expoClient !== null) {
        const expoClientExtra = (expoClient as Record<string, unknown>).extra;
        if (typeof expoClientExtra === "object" && expoClientExtra !== null) {
          const updateMessage = (expoClientExtra as Record<string, unknown>).updateMessage;
          if (typeof updateMessage === "string") {
            values.push(updateMessage);
          }
        }
      }
    }

    if (typeof metadata === "object" && metadata !== null) {
      const updateMessage = (metadata as Record<string, unknown>).updateMessage;
      if (typeof updateMessage === "string") {
        values.push(updateMessage);
      }
    }
  } catch {
    return values;
  }

  return values;
}

/** Case-insensitive search for the `[critical]` marker across the candidate manifest paths. Never throws; unreadable ⇒ `false`. */
export function hasCriticalMarker(manifest: unknown): boolean {
  try {
    return candidateMarkerStrings(manifest).some((value) =>
      value.toLowerCase().includes("[critical]"),
    );
  } catch {
    return false;
  }
}

/**
 * Two independent critical signals (§3 D1): the `[critical]` marker OR
 * `/config.criticalOtaVersion` naming an updateId we are not currently
 * running (belt-and-braces for clients that fetched before the marker
 * existed).
 */
export function isCriticalUpdate(args: {
  manifest: unknown;
  criticalOtaVersion: string | null;
  currentUpdateId: string | null;
}): boolean {
  if (hasCriticalMarker(args.manifest)) {
    return true;
  }

  return args.criticalOtaVersion !== null && args.criticalOtaVersion !== args.currentUpdateId;
}

export type UpdateCycleOutcome = "disabled" | "timeout" | "none" | "error" | "silent" | "critical";

/** Sentinel returned by the timeout race so it is distinguishable from a real check result. */
const TIMEOUT_SENTINEL = Symbol("ota-check-timeout");

/**
 * Runs one check → (fetch) → critical-decision cycle. Never throws, never
 * calls `reloadAsync`. Order (§3 flowchart): disabled short-circuit → race
 * the check against `timeoutMs` → check error → not-available → fetch →
 * critical decision.
 */
export async function runUpdateCycle(deps: {
  loader?: UpdatesApiLoader;
  criticalOtaVersion: string | null;
  timeoutMs?: number;
}): Promise<UpdateCycleOutcome> {
  const loader = deps.loader ?? defaultUpdatesApiLoader;
  const timeoutMs = deps.timeoutMs ?? COLD_START_CHECK_BUDGET_MS;

  let api: UpdatesUpdateApi | null;
  try {
    api = loader();
  } catch {
    return "disabled";
  }

  if (api === null || api.isEnabled !== true || typeof api.checkForUpdateAsync !== "function") {
    return "disabled";
  }

  const checkForUpdateAsync = api.checkForUpdateAsync;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT_SENTINEL), timeoutMs);
  });

  let checked: { isAvailable?: boolean; manifest?: unknown } | undefined | typeof TIMEOUT_SENTINEL;
  try {
    const checkPromise = checkForUpdateAsync().catch(
      (): { isAvailable?: boolean; manifest?: unknown } | undefined => {
        // A late rejection after the timeout has already won the race must
        // never surface as an unhandled rejection.
        return undefined;
      },
    );
    checked = await Promise.race([checkPromise, timeoutPromise]);
  } catch {
    clearTimeout(timer);
    return "error";
  }
  clearTimeout(timer);

  if (checked === TIMEOUT_SENTINEL) {
    return "timeout";
  }

  if (checked === undefined) {
    // The guarded `.catch(() => {})` above swallowed a rejection.
    return "error";
  }

  if (checked.isAvailable !== true) {
    return "none";
  }

  let fetched: { isNew?: boolean; manifest?: unknown };
  try {
    if (typeof api.fetchUpdateAsync !== "function") {
      return "error";
    }
    fetched = await api.fetchUpdateAsync();
  } catch {
    return "error";
  }

  const { updateId: currentUpdateId } = readOtaInfo();
  const manifest = fetched.manifest ?? checked.manifest;

  return isCriticalUpdate({ manifest, criticalOtaVersion: deps.criticalOtaVersion, currentUpdateId })
    ? "critical"
    : "silent";
}
