---
name: ui-review
description: Adversarial review checklist for any mobile UI diff before it is committed — design-system compliance, accessibility, safety copy, and test honesty. Use as the CHECKER lens on UI work.
---

# UI Review — adversarial checklist for mobile UI diffs

Review the staged/uncommitted UI diff the way the loop's CHECKER would: assume it is broken until proven otherwise, and verify with the actual files — never from the diff description.

## Verify in this order

1. **Regression surface**: grep every testID, route (`router.push/replace` targets), and param the diff touches — renames must be complete across screens, tests, AND docs (`docs/qa/*` checklists reference testIDs verbatim). A dangling old testID or a route to a placeholder is an automatic FAIL.
2. **Design-system §6 items** on each changed screen: tokens only (every `brand-*` class must exist in the packages/config tailwind preset — phantom classes silently render as *nothing*), 44pt targets (measure padding + font, don't trust intent), one-primary-button rule, four data states present and reachable.
3. **Accessibility**: roles/labels/states on every new Pressable; `alert` role on error/offline/undo banners; reduced-motion gating on every animation the diff adds; font scaling not disabled.
4. **Motion & perf**: no new repeating animation loops (the home gradient is the only sanctioned one); animations are ONE shared-value loop, not per-frame JS; no fresh-reference zustand selectors (`() => []` or object literals in selectors cause infinite re-renders under useSyncExternalStore — require module-level stable constants).
5. **Safety (§7, overrides everything)**: no "diagnosis"/dosing/med-recommendation copy; `<VetDisclaimer/>` and Emergency interstitial untouched or provably intact; paywall/upsell never gating the emergency path; record-only phrasing in trackers.
6. **State honesty**: undo/optimistic flows cannot silently drop data — trace every `clearTimeout`/unmount/rapid-repeat path; a cleared deferred write must be flushed (committed) or explicitly cancelled by the user, never discarded. Confirmation copy must not claim durability the code doesn't have.
7. **Test honesty**: new tests must be non-vacuous — for each, identify the one-line mutation that would make it fail (delete a guard, swap a route) and confirm it would. Snapshot churn must be explained by an intended visual change.
8. **Hygiene**: strings externalized, no `console.log`, no `any`/unjustified `@ts-ignore`, no new deps without §2r7 justification, `pnpm typecheck && pnpm lint && pnpm --filter mobile test` actually run (demand the exit codes).

## Output

A findings list split into **blocking** and **non-blocking**, each with file:line and a bounded fix suggestion, ending with VERDICT: PASS or FAIL. FAIL on any: data loss path, safety-copy violation, dangling rename, phantom token, or vacuous test claimed as coverage.
