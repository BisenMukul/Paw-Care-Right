---
name: new-screen
description: Scaffold a new Expo Router screen that is design-system-compliant from the first commit (states, a11y, tokens, tests). Use whenever adding any new screen or route to apps/mobile.
---

# New Screen — design-system-compliant scaffold

Create the new screen so it would pass the `docs/design-system.md` §6 checklist on day one — never "basic first, polish later".

## Required structure

1. **Route file** in `apps/mobile/app/...` (kebab-case, expo-router conventions; modals get `presentation: "modal"` in the root Stack options if listed there). Screen composes components from `apps/mobile/src/components/` — route files stay thin.
2. **Wrapper**: `ScreenScaffold` (or `SafeAreaView` + `bg-brand-50` + `px-4` gutter + `gap-6` until the scaffold primitive exists). NativeWind classes only; inline styles only for dynamic values.
3. **All four data states** for any server-backed content, each with a testID (`<screen>-loading|error|empty|offline`):
   - loading: content-shaped `Skeleton`, not a bare spinner
   - error: message + Retry `PrimaryButton` wired `loading={isFetching}`
   - empty: `EmptyState` — icon, one-line title, supportive sentence, exactly one CTA
   - offline: distinguish no-cache offline (`useIsOffline` + no data) from server-unreachable (`isApiError(e) && e.httpStatus === 0`)
4. **Data**: TanStack Query hooks from `packages/api-client` / `src/api/*` only; shapes from `packages/types` Zod schemas — never a hand-written duplicate interface.
5. **A11y + input**: every Pressable has role/label/state + press feedback + ≥44pt target; keyboard avoidance on forms; `maxFontSizeMultiplier={1.5}` on chrome text only; just-in-time permissions with a rationale screen first.
6. **Motion**: at most one `FadeInDown` entrance group, gated by the shared reduced-motion hook. No repeating loops.
7. **Strings**: all copy in `apps/mobile/src/strings.ts`; product name via `APP_DISPLAY_NAME`. §7 safety wording rules apply to every string (no "diagnosis", no dosing, record-only phrasing).
8. **Tests in the same commit**: a `__tests__/<screen>.test.tsx` covering all four states + the primary interaction, following the mocking pattern of the closest existing screen test (`await render(...)` required). Gates: `pnpm typecheck && pnpm lint && pnpm --filter mobile test`.

## Checklist before commit

testIDs on every state and interactive element · secure storage only via the guarded adapters (never AsyncStorage for tokens) · no `console.log` · no new deps without §2r7 justification · conventional commit referencing the task/hotfix id.
