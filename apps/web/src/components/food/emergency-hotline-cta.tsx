import { REGION_HOTLINES } from "@bombaypetcompany/data";

import { strings } from "../../strings";

/**
 * `urgent` — the pre-h1 emergency CTA, rendered only when
 * `model.showHotlineCta` (verdict toxic/emergency, D7). It is the first
 * element inside `<main>`, above the verdict hero (§5.3/§7.4 "escalation
 * before content").
 *
 * `info` — the R4 orchestrator decision: an always-on, non-alarmist
 * informational hotline section rendered on every page (including
 * caution/safe), lower on the page, so no page is ever a dead end (§5 fail
 * upward without alarmist caution pages). It reuses this SAME component so
 * both surfaces are driven by the exact same `REGION_HOTLINES` mapping —
 * never a second, divergent copy of the hotline list.
 *
 * Every number is rendered FROM `REGION_HOTLINES`; nothing here is a
 * hardcoded phone number or region.
 */
export type HotlineCtaVariant = "urgent" | "info";

export function EmergencyHotlineCta({ variant }: { variant: HotlineCtaVariant }) {
  const testId = variant === "urgent" ? "emergency-hotline-cta" : "hotline-info-section";
  const heading = variant === "urgent" ? strings.foodPage.emergency.heading : strings.foodPage.hotlineInfo.heading;
  const body = variant === "urgent" ? strings.foodPage.emergency.body : strings.foodPage.hotlineInfo.body;

  return (
    <section data-testid={testId} className="rounded-lg bg-red-50 p-4">
      <h2 className="text-lg font-bold text-red-900">{heading}</h2>
      <p className="mt-1 text-sm text-red-900">{body}</p>
      <ul className="mt-3 space-y-2">
        {REGION_HOTLINES.map((hotline) => (
          <li key={hotline.regionCode} className="text-sm text-red-900">
            <span className="font-medium">
              {hotline.poisonHotlineName} ({hotline.regionCode})
            </span>{" "}
            <a href={`tel:${hotline.dialNumber}`} className="underline">
              {hotline.displayNumber}
            </a>
            {hotline.feeNote ? (
              <span className="block text-xs text-red-800">
                {strings.foodPage.emergency.feePrefix}
                {hotline.feeNote}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-red-800">{strings.foodPage.emergency.fallback}</p>
    </section>
  );
}
