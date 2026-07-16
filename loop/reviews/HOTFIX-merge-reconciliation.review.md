# CHECKER Review — HOTFIX: merge reconciliation (founder crash-debug commit 059a697 / merge b144406)

Scope reviewed: 17 uncommitted porcelain paths (working tree vs HEAD `b144406`). Read-only on code; this file is my only write.

## Gates re-run independently (from repo root)

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS — 14/14 tasks, 0 errors |
| `pnpm lint` | PASS — 0 errors. Lone warning is an "unused eslint-disable directive" in `apps/api/coverage/lcov-report/block-navigation.js` (generated coverage artifact, not in this diff, pre-existing) |
| `pnpm --filter mobile test` | PASS — 59 suites / 441 tests / 15 snapshots |
| `pnpm --filter api-client test` | PASS — 5 suites / 53 tests |
| `pnpm build` | PASS — 8/8 tasks |

Full api suite not re-run (orchestrator reported 68 suites/743 EXIT=0; single-file api jest avoided per BullMQ-hang instruction). Non-blocking: the reconciliation touches no api files.

## Adversarial checks

### 1. Layout restoration fidelity — PASS
Diffed current `apps/mobile/app/_layout.tsx` against `git show b97f544:apps/mobile/app/_layout.tsx`. The ONLY differences are: (a) added `import { AppErrorBoundary } from "../src/error-boundary";`, and (b) `<AppErrorBoundary>` wrapping the subtree on BOTH the `restoring` splash branch and the main `Stack` branch. Auth gate, restore effect, network listener, all 17 `Stack.Screen` entries, and options (`presentation: "modal"`, `gestureEnabled: false`) are byte-identical to pre-merge. No placeholder, no `return null`.

Placement note (non-blocking): the boundary sits INSIDE `PersistedApiQueryProvider`, so if the provider itself threw during render the boundary would not catch it. This is acceptable — the provider is a stable context setup very unlikely to throw at render, and keeping the boundary inside preserves faithful restore of the founder's intent (a last-resort startup-crash screen). An outermost placement would be marginally safer but would deviate from the authorized "restore + wrap" and place the boundary outside SafeAreaProvider. Reasonable as-is.

### 2. safe-storage adapter correctness — PASS (with a test-coverage gap, non-blocking)
`createSafeStorage` native (createMmkv-succeeds) branch now returns an object implementing BOTH `SafeStorageLike` and `StorageLike`: `getString`/`set`/`remove` delegate to the raw MMKV instance, and `getItem`/`setItem`/`removeItem` are added — `getItem` uses `mmkv.getString(key) ?? null`, matching the memory branch's `null` semantics. This is the real fix: the declared `SafeStorageLike & StorageLike` return type was previously violated on the native path (raw MMKV lacks `getItem`/`setItem`/`removeItem`), which would crash zustand `createJSONStorage` consumers. The founder's fallback `catch {}` → memory Map is unchanged.

Gap (non-blocking): `safe-storage.test.ts` only exercises the memory-fallback branch (createMmkv throws). The native-success branch — exactly where the fixed bug lived — has NO direct test. Recommend a follow-up test injecting a fake `createMmkv` returning a SafeStorageLike stub and asserting the six methods delegate + `getItem` returns `null` on miss. Not blocking: typecheck now enforces the return type structurally, and behavior is straightforward delegation.

### 3. package.json exactness — PASS
Working-tree `apps/mobile/package.json` verified:
- `main` = `expo-router/entry` (restored from founder's `index.js`).
- `name`, `version`, `scripts` identical to pre-merge.
- 17 `expo-*`/`expo` packages back in `dependencies`, KEEPING the founder's `~57.0.x` bumps (e.g. `expo ~57.0.6`, `expo-router ~57.0.6`, `expo-secure-store ~57.0.1`).
- `react-native-reanimated` and `@expo/metro-runtime` REMOVED from `dependencies`.
- `typescript` back to `^5.9.3` (founder had pinned `~6.0.3`); `jest-expo ~57.0.2` kept in devDependencies.
- Diff vs `b97f544` shows ONLY version bumps + `jest-expo` bump — no structural drift. Diff vs `059a697` confirms the deps/devDeps split reverted to pre-merge shape.

Lockfile: `apps/mobile` importer section (pnpm-lock.yaml ~L165+) lists neither `react-native-reanimated` nor `@expo/metro-runtime` as direct deps. `@expo/metro-runtime@57.0.5` remains ONLY as a transitive peer inside expo's resolved version string — correct and expected, not a direct dependency. Genuinely absent as direct deps.

### 4. Deletions complete and clean — PASS
Confirmed absent on disk: `app/index.tsx`, `index.js`, `src/app-entry.tsx`, `src/bootstrap-entry.tsx`, `src/test-app.tsx`, `src/startup-safe-screen.tsx`. Grep across `apps/mobile/{src,app,__tests__}` for `bootstrap-entry|app-entry|test-app|startup-safe-screen` and `app/index` returns zero hits. No dangling imports. `main` = `expo-router/entry`.

### 5. eslint-disable justifications — PASS
Exactly 6 line-scoped disables, all `eslint-disable-next-line` with `-- JUSTIFIED:` rationale, no blanket/file-level disables:
- 5x `@typescript-eslint/no-require-imports` on lazy `require("react-native-mmkv")`: `src/api/query.ts:12`, `src/weight/weight-unit-store.ts:17`, `src/pets/active-pet-store.ts:16`, `src/pets/add-pet-store.ts:52`, `packages/api-client/src/mmkv-persister.ts:33`.
- 1x `no-console` on `console.error` in `src/error-boundary.tsx:20` (justified last-resort startup diagnostic; Sentry lands P9).
Diff scan for `: any`, `@ts-ignore`, `console.log`, `TODO` across all changed files: zero hits. §8 forbidden patterns clean.

### 6. Error-boundary test — PASS (non-vacuous, clean teardown)
`__tests__/error-boundary.test.tsx`: test 1 renders `<ThrowingChild/>` and asserts the fallback ("App failed to start" + the "boom" message) — this can ONLY pass if `getDerivedStateFromError` populates state and `render` returns the fallback, so removing `getDerivedStateFromError` would fail it (non-vacuous, matches executor's reported probe). Test 2 asserts children render normally when nothing throws. `console.error` is spied+`mockRestore()`d within test 1 so React's caught-error log doesn't leak. `mmkv-persister.ts`'s `MmkvLike` is now a structural interface + `options.mmkv?: MmkvLike`, resolving the TS2322 (memory `remove` void vs MMKV boolean) — verified in source and by clean typecheck.

### 7. Scope — PASS
Exactly the 17 porcelain paths. `git status --porcelain` filtered for `loop/`, `docs/`, `LOOP_PROTOCOL.md`, `CLAUDE.md` → none. No new dependencies added (two REMOVED). No secrets/.env touched.

## Founder-facing notes
- Expo Go now boots: MMKV native binding absent there falls back to in-memory storage on all five stores + the query persister + safe-storage, so no module-load or render crash. Persistence is memory-only in Expo Go (cache/prefs do not survive reload) — expected.
- A dev-client rebuild is still REQUIRED to get real native MMKV persistence and `react-native-svg` rendering; those bindings only load in a custom dev/prod build, not Expo Go.
- Follow-up (non-blocking): add a unit test for the safe-storage native-success adapter branch (§2 gap) — the one code path carrying the real bug fix currently lacks direct coverage.
- This is uncommitted working tree; commit per §4 "one task, one commit" with a conventional message referencing the hotfix.

VERDICT: PASS
