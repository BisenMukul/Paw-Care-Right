// T104 plan D1: a swappable shake-detection SEAM, NOT a real implementation
// in this card. `apps/mobile/package.json` has no `expo-sensors`, no
// `react-native-shake`, no accelerometer access of any kind -- React
// Native core exposes device-shake only to its own dev menu (native side),
// `DeviceEventEmitter` has no public production shake event, and
// `PanResponder`/Reanimated cannot read device motion. There is NO way to
// detect a real device shake with the dependencies in this tree.
//
// Adding a real implementation (e.g. `expo-sensors`) is a NATIVE module: it
// changes the app's native fingerprint (`runtimeVersion: { policy:
// "fingerprint" }`, `docs/OTA_UPDATES.md` §1), so existing beta builds could
// no longer receive this feature over OTA -- a full rebuild + re-submission
// would be required. That is a founder/checker decision (see the plan's
// D1/R1 + §7 founder to-do), not one this card makes unilaterally.
//
// This module is the swap point: `subscribeToShake` returns a no-op
// unsubscribe today. Landing a real detector later is a one-file change --
// `use-shake-to-report.ts` and every call site are already wired against
// this exact signature.

/** Subscribes to a device-shake gesture. Returns an unsubscribe function. */
export function subscribeToShake(onShake: () => void): () => void {
  // No-op by design (see header comment) -- `onShake` is intentionally
  // never invoked. Referencing it (a no-op call is never made) keeps this
  // an honest, typed seam rather than an unused-parameter lint violation.
  void onShake;
  return () => undefined;
}
