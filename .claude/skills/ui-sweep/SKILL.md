---
name: ui-sweep
description: Apply the docs/design-system.md per-screen consistency checklist to one or more mobile screens. Use when modernizing an existing screen or when the user asks to "make a screen consistent / modern / user friendly".
---

# UI Sweep — bring a screen up to the design system

You are applying `docs/design-system.md` (the law for this repo's UI) to the screen(s) named in the arguments. CLAUDE.md §6 (mobile standards) and §7 (safety content rules) still override on conflict.

## Procedure

1. **Read first**: `docs/design-system.md` in full, then the target screen file(s) under `apps/mobile/app/**` and every component they compose from `apps/mobile/src/components/`.
2. **Diff against the §6 checklist** — every unchecked item is work:
   - `ScreenScaffold` wrapper (safe-area, `bg-brand-50`, `px-4` gutter, `gap-6` sections); home alone keeps its gradient.
   - Header canon: `text-2xl font-bold text-brand-900` + `role="header"`.
   - All four data states: **skeleton** (content-shaped, never a bare full-screen spinner), error + Retry, `EmptyState` with one CTA, offline banner with `alert` role. Server-backed lists get pull-to-refresh.
   - Surfaces via canon components (`Card`/`IconTile`/`Chip`/`ListRow`) — no bespoke padding/radius/shadow; §1 tokens only.
   - Verified color pairs only; no `brand-500` normal-size text; no raw hex where a brand class exists.
   - One primary button per region; loading/disabled/pressed states; ≥44pt targets everywhere (hitSlop where padding can't).
   - Every Pressable: `accessibilityRole`, state, label (icon-only ⇒ `accessibilityLabel`), visible press feedback.
   - Motion: at most one entrance group (`FadeInDown` stagger), zero new repeating loops, everything gated by the shared `useReducedMotion()` hook.
   - Haptics only via `src/haptics.ts` at §3.3 moments.
   - Strings in `strings.ts`; product name only via `APP_DISPLAY_NAME`.
3. **Preserve behavior**: existing testIDs, routes, params, and safety chrome (`<VetDisclaimer/>`, Emergency interstitial precedence, paywall isolation) are byte-compatible unless the task explicitly says otherwise. Rewiring a route is a bug fix only when the old target is a placeholder — say so in the commit.
4. **Tests in the same commit**: update/add component + snapshot tests (repo requires `await render(...)`; mobile jest mocks live in `jest.setup.ts`). Run `pnpm typecheck && pnpm lint && pnpm --filter mobile test` before declaring done.
5. **Never touch** check-flow/emergency/disclaimer copy without flagging §7 review, and never introduce a dependency without a CLAUDE §2r7 journal justification.

## Output

One conventional commit per batch of screens, plus a short summary listing each checklist item fixed per screen and any §6-checklist item intentionally deferred (with reason).
