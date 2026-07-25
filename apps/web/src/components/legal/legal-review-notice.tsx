import { strings } from "../../strings";
import type { LegalReviewTopic } from "../../legal/legal-document";

/**
 * D1 — the visible LEGAL-REVIEW marker. A plain, always-rendered `<p>` (no
 * `hidden`, no `sr-only`, no `display:none`, no collapse/toggle) whose text
 * starts with the literal token `LEGAL-REVIEW`, plus a `data-legal-review`
 * attribute carrying the topic and a stable `data-testid` for tests and for
 * a human doing the C3 legal pass.
 */
const TOPIC_LABELS: Record<LegalReviewTopic, string> = {
  "company-entity": "Company entity and registered address",
  "sub-processors": "Sub-processors and service providers",
  retention: "Data retention",
  gdpr: "GDPR (EEA, EU and UK) rights",
  ccpa: "CCPA (California) rights",
  "international-transfers": "International data transfers",
  "subscription-terms": "Subscription terms and billing",
  disclaimers: "Disclaimers",
  liability: "Limitation of liability",
  jurisdiction: "Governing law and jurisdiction",
};

export function LegalReviewNotice({ topic }: { topic: LegalReviewTopic }) {
  return (
    <p
      data-testid="legal-review-marker"
      data-legal-review={topic}
      className="mt-3 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
    >
      {strings.legal.shared.reviewNotice(TOPIC_LABELS[topic])}
    </p>
  );
}
