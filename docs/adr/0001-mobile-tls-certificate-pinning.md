# ADR 0001: Mobile TLS Certificate Pinning

**Status: Deferred — not implemented** (2026-07-25, T096 security pass)

Nothing in this ADR is implemented. No native pinning configuration, config
plugin, or dependency exists in this repository as a result of it. This
document records the decision to defer, and the concrete conditions under
which the decision should be revisited.

## Context

Certificate pinning constrains which certificate(s) or public key(s) a
client will accept for a given host, beyond ordinary OS trust-store
validation. For Bombay Pet Company, the candidate target would be the
mobile app's connection to its own API (`bombaypetcompany.app`).

**Threat model.** The platform trust store (iOS/Android's built-in set of
CA roots) already authenticates `bombaypetcompany.app` for the overwhelming
majority of network conditions: a normal ISP, public Wi-Fi, or mobile
carrier network cannot forge a certificate for our domain without
compromising a publicly trusted CA. Pinning only adds defence against a
narrower threat: a user-installed or enterprise-managed MITM root
certificate (e.g. a corporate proxy, a parental-control appliance, or a
malicious profile installed on the device), or a mis-issued certificate
from a legitimate CA. Both are real but comparatively rare threats for a
consumer pet-care app that handles no payment card data directly
(RevenueCat handles IAP; no card entry happens in this app) and whose most
sensitive traffic is bearer-token-authenticated JSON, not raw credentials
in transit.

**Cost in this stack.** React Native/Expo networking runs over the OS's
own TLS stack (`NSURLSession` on iOS, `OkHttp`/`java.net` on Android).
Certificate pinning is not a JS-level concern here — it requires native
configuration: Android's `okhttp3.CertificatePinner` (or a `network
security config` XML) and iOS App Transport Security pinning (or a
third-party library such as TrustKit). Expo's managed workflow does not
expose either of these by default; adding real pinning would mean either
(a) a native Expo **config plugin** invoked at `expo prebuild`, which is
itself new native code generated into the iOS/Android projects, or (b) a
new native dependency (e.g. `react-native-ssl-pinning`/TrustKit). Either
path is a new native dependency under CLAUDE.md §2 rule 7 ("no new
dependencies without justification") and a real departure from this
project's current fully-managed-workflow assumption (no custom native
modules, no `ios`/`android` directories checked in).

**OTA interplay.** Per `docs/OTA_UPDATES.md` (referenced here, never
edited by this ADR): OTA (EAS Update) ships JS-only changes to already
installed native binaries. A certificate pin lives in native code, so:

- A server-side certificate rotation that isn't anticipated by the pinned
  set cannot be repaired by an OTA JS update — every installed app would
  need a new **store release** (App Store/Play Store review + rollout
  lag), during which the app could be fully unable to reach its own API.
- A wrong or overly narrow pin shipped in a native build is similarly
  unfixable by OTA.

This is a real, self-inflicted availability risk against a threat
(narrow-scope MITM) we have no evidence of today, and it would fall
directly on the same rollback/rollout machinery `docs/OTA_UPDATES.md`
governs for JS changes — except pinning bugs are precisely the class OTA
*cannot* fix.

**Third-party SDKs.** RevenueCat, Sentry, PostHog, and Expo Updates itself
each open their own network connections that this app does not control
the TLS configuration of. Pinning only our own API's connection would
still leave those SDKs' channels unpinned, so the coverage gained is
partial even if implemented perfectly.

**What we rely on instead today:**

- HTTPS everywhere (no cleartext traffic permitted).
- Short-lived access tokens with refresh-token rotation (T012–T017), so a
  stolen token in transit has a small blast-radius window.
- Tokens stored in the OS keychain via `expo-secure-store`
  (`apps/mobile/src/auth/secure-store.ts`), never in JS-readable storage.
- A server-side entitlement mirror for billing (T073) — RevenueCat, not
  this app, is the source of truth for purchases, and no card data ever
  transits this app's own API.
- Standard OS certificate-chain validation on every request.

## Decision

**Defer certificate pinning.** Do not implement it in the managed Expo
workflow at this stage of the product. This ADR documents the reasoning so
the decision is revisited deliberately, not by default, when the
underlying assumptions change (see Revisit triggers below).

## Consequences

- No native config plugin, no `ios`/`android` prebuild artifacts, no new
  native dependency is introduced by this decision.
- The app remains exposed to the narrow MITM/mis-issued-CA threat class
  described above, which is accepted as a documented, bounded risk given
  the absence of any observed incident and the app's non-payment-data
  posture.
- If a future requirement (see triggers) makes pinning necessary, it will
  require: leaving (or partially leaving) the managed workflow via a
  config plugin, choosing between `TrustKit`/`OkHttp` native
  configuration, adding rollback-safe key rotation for the pinned
  set(s), and re-validating the entire OTA rollback playbook against a
  pinning failure mode.

## Revisit triggers

Any one of the following should trigger a fresh ADR (not a silent
implementation) revisiting this decision:

1. The app leaves Expo's managed workflow for other reasons (e.g. a native
   module requirement elsewhere), removing the "no native code today"
   argument against the cost of adding pinning.
2. The app begins handling card data directly (rather than exclusively
   through RevenueCat's own SDK/UI), raising the stakes of a MITM enough
   to justify the availability trade-off.
3. A real, observed MITM or TLS-interception incident against this app or
   a comparable peer product in this space.
4. An enterprise or regulated-market deployment requirement (e.g. a B2B/
   veterinary-clinic distribution channel) that contractually requires
   pinning.
