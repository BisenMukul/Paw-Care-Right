# Store asset & screenshot kit (T100)

## 1. Purpose & scope

This kit generates the app's final icon/splash artwork (all required
densities) and produces the 8-shot marketing-screenshot set (device-framed,
captioned) from real captures of a staging/preview build. Everything here is
pure TypeScript run through `tsx` -- no new dependency was added (D1:
`sharp` stays `apps/api`-only). Store-listing *title/subtitle/description*
copy is owned by T102 (`docs/store-setup.md`); this kit owns only the
per-screenshot caption blocks.

## 2. Asset manifest

Single source of truth: `tools/asset-manifest.ts` (`ASSET_MANIFEST`). Every
row below is a real, generated, committed PNG.

| Path | Dimensions | Alpha | Store rule | Byte cap |
|---|---|---|---|---|
| `apps/mobile/assets/icon.png` | 1024x1024 | none | iOS marketing icon must have no alpha channel | 250 KB |
| `apps/mobile/assets/adaptive-icon.png` | 1024x1024 | yes | Android adaptive foreground; art inside centre 66% safe zone | 250 KB |
| `apps/mobile/assets/splash-icon.png` | 1024x1024 | yes | splash mark, light scheme | 250 KB |
| `apps/mobile/assets/splash-icon-dark.png` | 1024x1024 | yes | splash mark, dark scheme | 250 KB |
| `apps/mobile/assets/favicon.png` | 48x48 | yes | web favicon | 20 KB |
| `apps/mobile/store-assets/icons/app-store-icon-1024.png` | 1024x1024 | none | App Store listing icon | 250 KB |
| `apps/mobile/store-assets/icons/play-store-icon-512.png` | 512x512 | yes | Play 32-bit PNG icon | 120 KB |
| `apps/mobile/store-assets/icons/play-feature-graphic-1024x500.png` | 1024x500 | none | Play feature graphic | 250 KB |
| `apps/mobile/store-assets/icons/android-legacy/ic_launcher-mdpi-48.png` | 48x48 | none | launcher density reference set (mdpi) | 40 KB |
| `apps/mobile/store-assets/icons/android-legacy/ic_launcher-hdpi-72.png` | 72x72 | none | launcher density reference set (hdpi) | 40 KB |
| `apps/mobile/store-assets/icons/android-legacy/ic_launcher-xhdpi-96.png` | 96x96 | none | launcher density reference set (xhdpi) | 40 KB |
| `apps/mobile/store-assets/icons/android-legacy/ic_launcher-xxhdpi-144.png` | 144x144 | none | launcher density reference set (xxhdpi) | 40 KB |
| `apps/mobile/store-assets/icons/android-legacy/ic_launcher-xxxhdpi-192.png` | 192x192 | none | launcher density reference set (xxxhdpi) | 40 KB |
| `apps/mobile/store-assets/splash/splash-preview-light-1290x2796.png` | 1290x2796 | none | splash review preview (light) | 400 KB |
| `apps/mobile/store-assets/splash/splash-preview-dark-1290x2796.png` | 1290x2796 | none | splash review preview (dark) | 400 KB |

## 3. Regenerating assets

```
pnpm --filter mobile assets:generate
```

Rebuilds every PNG above from `tools/asset-manifest.ts` + `tools/raster.ts`
+ `tools/png-encode.ts` byte-for-byte (deterministic, no randomness). Add
`-- --check` to diff against the on-disk files instead of writing (non-zero
exit on drift; not wired into CI by this task).

## 4. Device profiles

`tools/screenshot-profiles.ts`'s `DEVICE_PROFILES` pins the exact store
canvas sizes:

| Profile | Label | Dimensions | Store |
|---|---|---|---|
| `ios-6-7` | iOS 6.7" | 1290x2796 | App Store |
| `ios-6-1` | iOS 6.1" | 1179x2556 | App Store |
| `ios-5-5` | iOS 5.5" | 1242x2208 | App Store |
| `android-phone` | Android phone | 1080x1920 | Play Store |

## 5. The 8-shot set

`tools/screenshot-profiles.ts`'s `SHOT_SET`, in canonical order:

| id | screen | route | capture notes |
|---|---|---|---|
| `01-home` | Home | `/(tabs)` | Home tab with an active pet, care-score card and today preview visible. |
| `02-symptom-check` | Symptom check | `/check` | Check entry screen showing the symptom category grid. |
| `03-check-result` | Check result | `/check/result/[checkId]` | A non-emergency check result with the vet disclaimer visible in-frame. |
| `04-food-safety` | Food & toxin safety | `/chat` | Chat screen after tapping the 'food' quick prompt, showing a food-safety answer. |
| `05-reminders` | Reminders | `/(tabs)/care` | Care tab agenda with upcoming vaccine/parasite/medication reminders. |
| `06-timeline` | Timeline | `/(tabs)/timeline` | Timeline tab showing a pet's health-log history. |
| `07-chat` | Ask chat | `/chat` | Chat screen with an in-progress conversation and the quick prompts row. |
| `08-plus` | Paywall/plans | `/paywall` | Paywall/plans screen showing the subscription tiers. |

`04-food-safety` and `07-chat` intentionally share the `/chat` route: F3
(Food & Toxin Safety) has no dedicated mobile screen in this repo -- it is
answered by chat itself (see `src/components/chat/quick-prompts.tsx`).

## 6. Capturing from a staging build (founder)

This container is headless Linux -- no iOS Simulator, no Android emulator,
no staging build (D5). On a Mac/AVD:

1. Build/install the `preview` EAS profile (see `docs/release-runbook.md`).
2. Run the `.claude/skills/emulator-test/SKILL.md` flow with the seeded
   demo accounts, navigating to each shot's route.
3. Save each capture as `apps/mobile/store-assets/raw/<shot-id>.png`:
   - iOS Simulator: `xcrun simctl io booted screenshot <file>`
   - Android AVD: `adb exec-out screencap -p > <file>`
4. File-naming contract: exactly `<shot-id>.png` per §5 (e.g. `01-home.png`).

## 7. Composing

```
pnpm --filter mobile store:screenshots
```

Reads `apps/mobile/store-assets/raw/<shot-id>.png` for every shot in §5,
composites it into every profile in §4 (brand background, caption band,
programmatic device frame), and writes
`apps/mobile/store-assets/out/<profile-id>/<shot-id>.png` plus a
`<shot-id>.txt` caption sidecar and a combined `out/copy-blocks.md`. Fails
loudly (non-zero exit + a checklist of expected filenames) if `raw/` is
empty. Flags: `--input=<dir>`, `--output=<dir>`, repeatable `--profile=<id>`.

## 8. Marketing copy blocks

`marketing-strings.ts`'s `storeMarketing.en.shots` (headline <= 40 chars,
subhead <= 90 chars, safety-linted by `__tests__/store-marketing-strings.test.ts`):

| Shot | Headline | Subhead |
|---|---|---|
| `01-home` | Peace of mind for pet parents | See your pet's care, reminders, and history in one simple home screen. |
| `02-symptom-check` | Something seem off? Start here | Answer a few quick questions about your pet's symptoms for guidance on next steps. |
| `03-check-result` | Guidance you can act on | Every result includes plain-language guidance and the vet disclaimer, front and center. |
| `04-food-safety` | Wondering if a food is safe? | Ask about foods and household items and get clear, judgment-free guidance. |
| `05-reminders` | Never miss a vaccine again | Simple reminders for vaccines, parasite prevention, grooming, and vet visits. |
| `06-timeline` | Your pet's whole story, organized | A timeline of weight, activity, and health notes you can share with any vet. |
| `07-chat` | Ask anything, any time | A calm place to ask pet-care questions and get plain-language guidance. |
| `08-plus` | More peace of mind with Plus | Unlock unlimited checks, chat, and family sharing for the whole household. |

Every composed shot's `.txt` sidecar also carries the disclosure line
(`strings.check.result.disclaimer(APP_DISPLAY_NAME)`, single-sourced from
`src/strings.ts`, never restated here as a separate literal).

## 9. Honest limits

- **Caption text is not burned into pixels (D3).** Rendering headline text
  onto the canvas needs a font rasteriser -- a real new dependency, out of
  scope (D1). Captions ship as the `.txt` sidecar + `copy-blocks.md`
  instead; apply them in a design tool over the composited PNGs if a
  listing wants burned-in text, or file a follow-up card for a
  font-rasterising compositor.
- **Splash is artwork-only (D6).** `expo-splash-screen` is not in
  `pnpm-lock.yaml` (no native splash plugin exists in this SDK's config
  surface yet) -- final splash artwork + light/dark full-device preview
  PNGs are shipped, but no build wires them today. Once installed
  (`npx expo install expo-splash-screen`), add:

  ```js
  [
    "expo-splash-screen",
    {
      image: "./assets/splash-icon.png",
      dark: { image: "./assets/splash-icon-dark.png", backgroundColor: "#0c140f" },
      backgroundColor: "#F4EFE6",
    },
  ],
  ```

  to `app.config.js`'s `plugins` array.
- **No simulator/staging build in this environment (D5).** §6's founder
  capture step is the only way to close the "from staging build" half of
  the card's acceptance criterion; it is not fabricated here.

## 10. Verification status (honest)

Time-boxed `expo-doctor` attempt (T099 step-9 pattern), run on 2026-07-29
against this exact tree (no file was mutated by the CLI --
`git status --porcelain` before and after the run were identical):

```
cd apps/mobile && npx --yes expo-doctor@latest
```

```
Running 20 checks on your project...
19/20 checks passed. 1 checks failed. Possible issues detected:
Use the --verbose flag to see more details about passed checks.

✖ Check that packages match versions required by installed Expo SDK

❗ Major version mismatches
package                 expected  found
@sentry/react-native    ~7.11.0   8.20.0

⚠️ Minor version mismatches
package                 expected  found
react-native-screens    ~4.26.0   4.25.2

🔧 Patch version mismatches
package                 expected  found
expo                    ~57.0.8   57.0.6
expo-auth-session       ~57.0.5   57.0.3
expo-constants          ~57.0.7   57.0.5
expo-dev-client         ~57.0.9   57.0.6
expo-image-manipulator  ~57.0.6   57.0.4
expo-image-picker       ~57.0.6   57.0.4
expo-linking            ~57.0.4   57.0.3
expo-notifications      ~57.0.7   57.0.5
expo-router             ~57.0.8   57.0.6
expo-web-browser        ~57.0.2   57.0.1

12 packages out of date.
1 check failed, indicating possible issues with the project.
```

The single failing check is a pre-existing Expo SDK package-version
mismatch across 12 packages (none of which this task touches or added --
they predate T100). Fixing them is out of scope here (CLAUDE §2.2 --
scope creep is a defect); it is a standing item, not a T100 regression.
Every other check -- including the ones that would catch a malformed
icon/splash asset or an app.config.js schema error -- **passed** (19/20).
`__tests__/store-assets-manifest.test.ts` remains the standing *offline*
gate for "assets pass ... store size specs" so this can be re-verified
without network access.

## 11. Founder to-dos

1. Capture the 8 real screens from a `preview` build (§6), run
   `pnpm --filter mobile store:screenshots`, upload `out/<profile>/...` to
   App Store Connect / Play Console, and paste the caption blocks from
   `out/copy-blocks.md`. Paste the result into `loop/journal.md`.
2. Activate the splash: `npx expo install expo-splash-screen`, add the
   plugin block in §9, rebuild.
3. Optional: bake the §8 copy into the composited PNGs in a design tool
   (or file a follow-up card for a font-rasterising compositor).
4. Re-check at the C3 checkpoint: if T102 changes the display name/bundle
   id, the icon artwork itself is name-free (no wordmark is rasterised) and
   needs no change; only store-listing copy does.
