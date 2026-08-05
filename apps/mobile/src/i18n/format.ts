// T110 §2.6 (AC3): date/decimal localization. Read docs/I18N.md before
// editing.
import type { LocaleId } from "@bombaypetcompany/config";

/**
 * Calendar-date display. `en` is PINNED to the app's existing ISO
 * YYYY-MM-DD convention (D5) — changing English date presentation is a
 * product decision, not an i18n scaffold decision, and would churn frozen
 * snapshots. Every other locale formats via Intl with a FIXED UTC time zone
 * so output is deterministic in CI (independent of the host's `TZ`).
 */
export function formatEntryDate(iso: string, locale: LocaleId): string {
  const date = new Date(iso);
  if (locale === "en") {
    return date.toISOString().slice(0, 10);
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Locale-correct decimal separator; fixed fraction digits; grouping-free by
 * domain (F11 — the app's weight domain never reaches a grouping
 * separator, so this is safe for `formatWeight` to delegate to unmodified).
 */
export function formatDecimal(value: number, locale: LocaleId, fractionDigits = 1): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: false,
  }).format(value);
}
