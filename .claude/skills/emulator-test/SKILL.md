---
name: emulator-test
description: Drive the iOS Simulator (Mac) or Android emulator through every app screen — full visual walkthrough of all ~35 screens in both themes with the seeded demo data. Run locally on a machine with a simulator/emulator; never in a remote session.
---

# Emulator test — full-app screen walkthrough

Drives the running simulator/emulator through EVERY screen of the app,
verifying each renders correctly in both light (cream) and dark (PawSaathi)
themes against the design reference (`docs/design/pawsaathi.dc.html` +
`docs/design/screenshots/`).

## One-time setup (the human runs these once)

**macOS — iOS Simulator (preferred, official):** use the Claude Code Desktop
app's built-in iOS Simulator pane (Xcode + a simulator runtime installed;
docs: code.claude.com/docs/en/desktop-ios-simulator). Boot the simulator,
open the app via Expo (`pnpm --filter mobile start`, press `i`), and drive it
through the pane's screenshot/tap tools.

**Android AVD (macOS or Windows) — community MCP server:**
- macOS/Linux: `claude mcp add --transport stdio mobile -- npx claude-in-mobile@latest`
- Windows: `claude mcp add --transport stdio mobile -- cmd /c npx claude-in-mobile@latest`
- Android Studio with an AVD created; `adb` on PATH (`adb devices` shows the emulator when booted).

## Preflight (verify ALL before testing; abort with a clear message if any fails)

1. `adb devices` lists a booted emulator.
2. Postgres running and migrated; demo seed applied (`pnpm --filter api prisma:migrate:dev` then `pnpm --filter api prisma:seed`).
3. API dev server running (`pnpm dev` or `pnpm --filter api dev`) — OTP codes print to its console.
4. Metro running (`pnpm --filter mobile start`) and the app installed/openable on the emulator (Expo Go or dev client).
5. MCP `mobile` tools respond (`device` action=list).

## Sign-in (seeded demo)

Owner: `owner@pawcareright.local` · Family member: `family@pawcareright.local`.
Enter the email on the email screen; read the 6-digit code from the API console
line `OTP for <email>: <code>`; enter it on the OTP screen. Full data map:
`apps/api/prisma/seed/README.md` (Buddy = rich data, Luna = sparse).

## Protocol

- Screenshot EVERY screen (`screen` capture) before judging it; use `ui` find/assert_visible for key elements; navigate by tapping real UI (not deep links) so navigation is tested too.
- Run the full inventory in LIGHT mode first, then flip the emulator to dark (`system` shell: `adb shell cmd uimode night yes` (Android) / Simulator menu Features → Toggle Appearance (iOS)) and repeat at least the themed-representative subset (home, care, timeline, activity, check result, paywall, services hub).
- Never weaken or skip the safety screens: the emergency interstitial is reached via the seeded red-flag check in history; verify the disclaimer is present on every check result.
- If a screen errors/blanks: screenshot, capture `system` logs, note it, continue (do not fix mid-run).

## Screen inventory (all must be visited)

**Auth/onboarding:** welcome → email → OTP → done; push-rationale; add-pet wizard (species → breed → details → photo → done — create then delete nothing; use Back/Start-over to exit without saving a new pet).
**Tabs:** Home (hero, Care Score ring, quick actions, Up next), Care hub (deep-green hero, colorful tiles, agenda), Timeline (rail, filters, photo viewer if present), Settings (all rows incl. Services and Sign out — do NOT tap Sign out until the very end).
**Pet:** pet profile (pets/[id]), activity logger (chip → sheet → save; recents undo; Today strip), weight (chart + add form), note, vet-visit, care-plan, reminders/edit (chips, steppers, medication form view-only).
**Check flow:** entry (category grid + recents), one intake run (chips + quick-picks + review; category "vomiting"; SUBMIT ONLY IF the API's AI provider is configured — otherwise stop at review and Back out), result screens via seeded history (one per urgency tier incl. FALLBACK), emergency interstitial via the seeded red-flag check (verify hotline + acknowledge), history list.
**Services (all preview):** hub → book menu → vet list → slots → preview-end; salons; store; adopt browse → detail → preview-end; insurance. Verify the PREVIEW banner on every service screen and that no terminal claims success.
**Billing:** paywall (via Settings → Upgrade; do NOT purchase), upsell sheet if reachable, family screen, notifications settings, join screen only if a code exists.
**Finally:** Settings → Sign out; verify return to welcome; sign back in as the family member; spot-check home renders their shared household.

## Report format

A single summary: per-screen table (screen · light ✓/✗ · dark ✓/✗ · notes),
every defect with its screenshot and reproduction path, and a final
verdict — which screens match the design reference and which need work.
No code changes during the run; findings only.
