/**
 * T072 plan decision 5: RevenueCat already folds billing-retry grace into
 * the `expiresAt` it sends on a `PREMIUM` row, so this service adds none.
 * The clock is authoritative for expiry -- a delayed renewal webhook briefly
 * shows the caller as expired rather than silently extending premium
 * (fail-safe: losing premium early is never a §5 safety issue). This is the
 * single tuning knob if that RevenueCat assumption ever changes.
 */
export const SUBSCRIPTION_GRACE_MS = 0;
