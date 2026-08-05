# T104 Planner progress ledger

- [x] Step 0: Read CLAUDE.md + PHASES.md T104 card (lines 503-505). Skeleton written.
- [x] Step 1: mobile package.json dep audit — NO expo-sensors, NO react-native-view-shot, NO screenshot lib. expo-image-picker + expo-image-manipulator PRESENT.
- [x] Step 2: packages/analytics — Sentry scrub (T089) drops breadcrumb `message` wholesale + console-category entirely; mobile `captureError` in src/observability/sentry.ts, lazy-required, no-op without DSN.
- [x] Step 3: api idiom — photos module (controller/service/dto + StorageService presign), me/privacy module (per-user, @CurrentUser, no household scope) = the model for feedback.
- [x] Step 4: prisma schema model list + T091 DMMF cascade-completeness guard at apps/api/src/me/account-erasure-cascade-completeness.spec.ts (NEW MODEL MUST BE ADDED THERE).
- [x] Step 5: account-erasure.service.ts S3 prefix lines (~131 FULL_HOUSEHOLD, ~184 USER_ONLY) — feedback/<userId>/ must join exports/<userId>/.
- [x] Step 6: mobile surfaces — _layout.tsx banner slot (OfflineBanner, normal flow, §7 rule 4), settings.tsx ListRow idiom, strings.ts, config.ts + app.config.js extra, jest-expo config, __tests__ idiom.
- [x] Step 7: LANDMINE FOUND — packages/ai detector DIAGNOSIS_WORD_PATTERN = /diagnos/i (detector.ts:81) is run over the whole mobile strings tree by strings-detector-lint.test.ts => "diagnostic logs" would FAIL the gate. Plan forbids the word.
- [x] Step 8: e2e harness idiom (account-privacy.e2e-spec.ts: real pg + MinIO + factories), coverage-gate (>=80% api services), migrations dir naming convention.
- [x] Step 9: FULL PLAN WRITTEN to loop/plans/T104.plan.md — 7 design decisions, 28 ordered steps, exhaustive inventory (incl. migration path), AC->proof map (13 rows), gates, top-5 risks, founder delta. STATUS: COMPLETE.
