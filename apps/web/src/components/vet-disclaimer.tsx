import { APP_DISPLAY_NAME } from "@bombaypetcompany/config";

import { strings } from "../strings";

/**
 * Shared, non-dismissible vet-consult disclaimer (CLAUDE §5.1 / §7.3). Web
 * counterpart of the mobile `<VetDisclaimer/>`: a plain `<div>`/`<p>` with no
 * button, no `onClick`, no `hidden` attribute, no collapse and no client
 * component — structurally impossible to dismiss. Copy is verbatim the
 * mobile wording (`apps/mobile/src/strings.ts` → `check.result.disclaimer`)
 * so the two surfaces cannot drift.
 */
export function VetDisclaimer() {
  return (
    <div data-testid="vet-disclaimer" role="note" className="rounded-lg bg-brand-50 px-4 py-3">
      <p className="text-center text-sm text-brand-900">{strings.disclaimer(APP_DISPLAY_NAME)}</p>
    </div>
  );
}
