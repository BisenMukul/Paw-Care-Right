/**
 * Vet-consult disclaimer sentence (T097 plan D2; CLAUDE §7 rule 3 — every AI
 * result screen renders the disclaimer component, non-dismissible).
 *
 * Before this task, `apps/mobile/src/strings.ts` (`check.result.disclaimer`)
 * and `apps/web/src/strings.ts` (`disclaimer`) each hand-typed an
 * independent copy of the same sentence. This function is the ONE source of
 * truth both apps delegate to, so the two surfaces cannot drift byte-for-byte
 * (mirrors the `MEDICATION_STATIC_COPY` / `VET_SUMMARY_DISCLAIMER` precedent
 * of safety-critical copy living in `@pawcareright/types`).
 *
 * Constraints on the returned sentence (mechanically asserted by
 * `vet-disclaimer-copy.spec.ts`, never by convention alone): no "diagnos*"
 * substring (CLAUDE §7 rule 1), no digit+unit dose pattern (CLAUDE §7 rule
 * 2), and no hardcoded product display name (CLAUDE §1a) — `appName` is
 * always a parameter, injected by the caller from the shared
 * `APP_DISPLAY_NAME` constant at the render site. This file does not import
 * `@pawcareright/config` itself, keeping the §1a injection point at the
 * render site and this package free of a runtime dependency on config.
 */
export function vetDisclaimerLine(appName: string): string {
  return `${appName} offers general pet-care guidance, not veterinary care or treatment. Always consult a licensed veterinarian.`;
}
