# Mobile on-device storage audit (T096)

Scope: every persistence site under `apps/mobile/{src,app}` -- what stores what,
in which medium, and why that medium is the right one. Pinned and enforced by
`apps/mobile/__tests__/storage-audit.test.ts`.

## The headline fact

**MMKV is not encrypted in this app.** `apps/mobile/src/storage/safe-storage.ts`
creates the MMKV instance with no encryption key (`createMMKV()`), and falls
back to an in-memory `Map` when the native binding is missing (e.g. in some
test/CI environments). Nothing that is a credential, access/refresh token,
OTP, password, or contact identifier (email/phone) may ever be written to it.
The only place any of those may live on-device is the OS keychain, reached
exclusively through `src/auth/secure-store.ts`.

## Medium 1 -- SecureStore (OS keychain), via `src/auth/secure-store.ts`

`expo-secure-store` is imported by exactly one file in the whole app
(enforced by the static scan). It stores exactly two keys:

| Key | Data class | Why SecureStore |
|---|---|---|
| `pawcareright.auth.accessToken` | Credential (short-lived bearer token) | OS-keychain-backed, encrypted at rest, not readable by other apps. |
| `pawcareright.auth.refreshToken` | Credential (long-lived rotation token) | Same as above -- this is the one credential that must survive an app restart, so it cannot live only in memory. |

No other credential-shaped value (password, OTP, API key, session id) is
persisted anywhere in the app; auth state that isn't a token (e.g. "is the
user logged in") is derived from whether a token is present, not stored
separately.

## Medium 2 -- MMKV (unencrypted), via `src/storage/safe-storage.ts`

Seven zustand stores persist to MMKV today via
`createJSONStorage(() => mmkvStorage)`. The static scan pins this exact list
by name -- adding an eighth store fails the test until this table is updated,
which is the point: a new persistence site in an unencrypted store deserves a
human look before it merges.

| Store name | File | Data class | `partialize` shape | Why MMKV (unencrypted) is correct here |
|---|---|---|---|---|
| `pawcareright.activity-recents` | `src/health-logs/activity-recents-store.ts` | Preference/recents cache | `{ byPet }` -- per-pet recently-used activity chips | Non-sensitive UI convenience data (which quick-log chips a household used recently); no PII, no credential. |
| `pawcareright.paywall-shown` | `src/billing/paywall-shown-store.ts` | Preference | `{ shown }` -- has the paywall been shown this session/cohort | A boolean flag; carries no personal or billing data (entitlement itself is server-mirrored, not stored here). |
| `pawcareright.weight-unit` | `src/weight/weight-unit-store.ts` | Preference | `{ override }` -- kg/lb display override | Pure UI preference, no sensitivity. |
| `pawcareright.reminder-outbox` | `src/offline/outbox-store.ts` | Queue (offline-write buffer) | `{ items }` -- pending reminder-ack writes not yet synced | Operational queue data (which reminder was acknowledged offline), not a credential or contact identifier. |
| `pawcareright.active-pet` | `src/pets/active-pet-store.ts` | Preference | `{ activePetId }` -- which pet is currently selected | An opaque server-generated UUID selecting a already-authorized pet; not sensitive on its own (useless without the session's own access token, which is never here). |
| `pawcareright.add-pet-draft` | `src/pets/add-pet-store.ts` | Draft (resumable form state) | `{ draft, stepIndex }` -- in-progress add-pet wizard answers | Draft pet profile fields (name, species, breed, etc.) -- not a credential or contact identifier; resumability is the entire point of persisting it. |
| `pawcareright.analytics-consent` | `src/analytics/consent-store.ts` | Preference | `{ enabled }` -- analytics opt-in/out | A boolean consent flag; must survive restart precisely so consent doesn't need re-asking, and carries no personal data itself. |

Every entry above was checked against the credential-shaped pattern the
static scan enforces (`(access|refresh)?token|password|passwd|otp|secret|
api[_-]?key|credential|jwt`, case-insensitive) over both the `name` and
`partialize` declarations -- none match, and the test's own non-vacuity case
proves the pattern isn't simply inert.

## AsyncStorage

`@react-native-async-storage/async-storage` is not a declared dependency
(confirmed unresolvable by `__tests__/token-storage.test.ts`) and is not
referenced anywhere in `apps/mobile/{src,app}` (confirmed by
`storage-audit.test.ts`). There is exactly one persistence abstraction in
this app: SecureStore for the two token keys, MMKV (via `safe-storage.ts`)
for everything else.

## Memory-only fallback

`safe-storage.ts` falls back to an in-memory `Map` when the native MMKV
binding cannot be loaded (documented there). This only ever *reduces*
exposure relative to disk-backed MMKV (the data disappears with the process),
so it does not change any of the classifications above.
