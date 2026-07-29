# Accessibility (VoiceOver/TalkBack) script — T093

> This script has **NOT been executed on a device by the loop.** It is the
> procedure a human runs on real hardware, for the 5 core flows named by the
> T093 acceptance criterion (welcome→sign-in; home→check→result→emergency;
> activity logging; reminders; chat). Every step row carries **exactly one**
> of these two tags:
>
> - `[AUTO: a11y-sweep` followed by ` › ` and the exact `it()` title, closed
>   with `]` — the step's *executable* half
>   (element has a role; element has a label; state announcements like
>   `selected`/`disabled`/`alert` are present; reading order) is asserted by
>   a named test in `apps/mobile/__tests__/a11y-sweep.test.tsx`. Every tag
>   below is mechanically verified to name a real, passing test —
>   `a11y-static-scan.test.ts`'s rule 4 extracts every `[AUTO: …]` tag from
>   this file and asserts it appears verbatim as an `it()`/`describe()`
>   title in `a11y-sweep.test.tsx`; a renamed or deleted test fails that
>   check, so this doc cannot silently rot into citing tests that no longer
>   exist.
> - `[DEVICE-ONLY]` — the part only a real screen reader on real hardware
>   can answer (swipe order under the actual rotor, focus trapping,
>   announcement *audibility*, gesture conflicts, physical reachability,
>   `AccessibilityInfo.setAccessibilityFocus` actually moving focus). These
>   rows carry an **unfilled** `Result:` column — do not write a result here
>   until the on-device pass actually happens.
>
> No sentence in this document, or in the journal entry this card
> contributes, may claim a device screen-reader session occurred. If you
> find one, that is a defect — see `docs/qa/a11y-audit.md` §7.

---

## Flow 1 — welcome → sign-in

| Step | Action | Expected announcement | Tag | Result |
|---|---|---|---|---|
| 1 | Cold-launch the app (no session) | VoiceOver/TalkBack focuses the welcome screen; the paw icon is skipped (decorative) | `[DEVICE-ONLY]` | |
| 2 | Swipe to the app title | Announces "Bombay Pet Company, header" | `[AUTO: a11y-sweep › the screen title is a header]` | |
| 3 | Continue swiping | Reading order is title → tagline → "Continue with email" → social buttons (no jump-around) | `[AUTO: a11y-sweep › reading order matches visual order]` | |
| 4 | Swipe through every focusable element on the screen | Each one announces a role or a label — never silent | `[AUTO: a11y-sweep › every welcome-screen interactive element exposes a role or a label]` | |
| 5 | Double-tap "Continue with email" | Navigates to the email screen; VoiceOver/TalkBack focus lands near the top (not lost) | `[DEVICE-ONLY]` | |
| 6 | Enter an invalid email, submit | The error text is announced automatically (live-region) | `[AUTO: a11y-sweep › email screen's invalid-email error carries accessibilityRole=alert]` | |
| 7 | Confirm focus visibly moves to the email field after the failed submit | Focus lands on the errored field, not left on the Submit button | `[DEVICE-ONLY]` | |

---

## Flow 2 — home → check → result → emergency

| Step | Action | Expected announcement | Tag | Result |
|---|---|---|---|---|
| 1 | From Home, swipe through the quick-actions grid and pet hero card | Every tile/card announces a role or label (cross-reference: pre-existing `sweep4-a11y.test.tsx`/`touch-targets.test.tsx` coverage — not re-asserted by this card's own suite) | `[DEVICE-ONLY]` | |
| 2 | Tap "Something wrong?" → pick a category → answer the intake questions | Each question's prompt is announced as the step advances; single-select options announce `selected`/not-selected (cross-reference: pre-existing `check-flow-a11y.test.tsx` coverage) | `[DEVICE-ONLY]` | |
| 3 | On the review step, activate an "Edit" link with an actual fingertip | Reaches the control without a mis-tap on an adjacent row | `[DEVICE-ONLY]` | |
| 4 | Land on the check-result screen | Reading order is urgency banner → summary → sections → disclaimer → actions | `[AUTO: a11y-sweep › check-result screen's reading order is banner -> content -> disclaimer -> actions]` | |
| 5 | Swipe through the 5 result sections | Each section title announces "…, header" | `[AUTO: a11y-sweep › check-result screen's 5 section titles are headers, and its 3 canon actions reach the 44pt target]` | |
| 6 | Use the rotor's "Headings" mode to jump between the 5 sections | Rotor jumps land exactly on each section title, in order | `[DEVICE-ONLY]` | |
| 7 | Reach "Find a vet" / "Share" / "Done" with a real fingertip | Each is reachable without mis-tapping a neighbor | `[DEVICE-ONLY]` | |
| 8 | (Red-flag case) land on the Emergency interstitial | Screen reader announces the go-now badge and title immediately; the takeover cannot be swiped/backed away from | `[DEVICE-ONLY]` — **known finding, not fixed this card (R7):** the emergency screen's titles carry no explicit `accessibilityRole="header"` (frozen surface — see `docs/qa/a11y-audit.md` §6) | |
| 9 | Confirm no motion plays on the emergency screen, with device "Reduce Motion" both on and off | No animation intercepts or delays the takeover, in either setting | `[AUTO: a11y-sweep › emergency interstitial renders no animation node (D5 pin)]` | |

---

## Flow 3 — activity logging

| Step | Action | Expected announcement | Tag | Result |
|---|---|---|---|---|
| 1 | Land on the activity screen | Title announces "Log activity, header" | `[AUTO: a11y-sweep › the activity screen title is a header]` | |
| 2 | Swipe through the recents row, the chip grid, and the quantity sheet's controls | Every element announces a role or a label | `[AUTO: a11y-sweep › every interactive element (chip grid + open quantity sheet) exposes a role or a label]` | |
| 3 | Double-tap an activity type chip (e.g. "Food") | Opens the quantity sheet; focus lands inside it (not left behind on the grid) | `[DEVICE-ONLY]` | |
| 4 | Toggle the unit chip (meals ↔ grams) | Announces "selected"/not-selected as the toggle changes | `[AUTO: a11y-sweep › chip/unit selected state is exposed (both a selected and an unselected element)]` | |
| 5 | Reach every stepper/chip/link in the sheet's rendered class (min-height/hitSlop) | Every target's class/hitSlop clears the 44pt floor | `[AUTO: a11y-sweep › every interactive element reaches the 44pt target]` | |
| 6 | Reach the same targets with an actual fingertip, incl. "Add a written note instead" and "Cancel" | Every target is reachable without a mis-tap | `[DEVICE-ONLY]` | |
| 7 | Tap a "recent" chip | The undo banner is announced automatically the instant it appears | `[AUTO: a11y-sweep › the undo banner carries accessibilityRole=alert]` | |
| 8 | Let the undo window elapse without acting | The entry saves silently in the background (no further announcement expected) | `[DEVICE-ONLY]` | |

---

## Flow 4 — reminders

| Step | Action | Expected announcement | Tag | Result |
|---|---|---|---|---|
| 1 | Open "New reminder" | Every schedule control (frequency segments, weekday chips, interval/month-day steppers) announces a role or label | `[AUTO: a11y-sweep › every ScheduleBuilder interactive element exposes a role or a label]` | |
| 2 | Switch frequency to Weekly, then tap a day chip | Frequency/day controls announce `selected` for the active choice and not-selected for the others | `[AUTO: a11y-sweep › selected state is exposed on the frequency segmented control (both a selected and unselected value)]` | |
| 3 | Reach the interval +/- steppers | Each announces "Decrease interval"/"Increase interval" (never silent, never just "button") | `[AUTO: a11y-sweep › every stepper Pressable reaches the 44pt target (hitSlop) and carries an accessibility label]` | |
| 4 | Reach the same steppers with an actual fingertip | Each is reachable via its `hitSlop`, without mis-tapping the value text between them | `[DEVICE-ONLY]` | |
| 5 | Reach the date/time steppers elsewhere on this screen (`reminder-startdate-*` etc.) | *(Known finding, out of this card's file list — `app/reminders/edit.tsx` is not in T093's "Files to create/modify"; see `docs/qa/a11y-audit.md` §2.)* | `[DEVICE-ONLY]` | |
| 6 | Save | Confirms and returns; no silent failure | `[DEVICE-ONLY]` | |

---

## Flow 5 — chat

| Step | Action | Expected announcement | Tag | Result |
|---|---|---|---|---|
| 1 | Open chat with an active pet | The active-pet badge, quick-prompt chips, composer input, and send button all announce a role or a label | `[AUTO: a11y-sweep › every chat-screen interactive element exposes a role or a label]` | |
| 2 | Send a message and let the assistant reply stream in | New transcript content is read as it settles, without interrupting the user mid-typing | `[DEVICE-ONLY]` | |
| 3 | Trigger a nudge card (symptom-flagged reply) | The nudge card announces its escalation CTA before the assistant bubble is read (matches server emission order) | `[DEVICE-ONLY]` | |
| 4 | Reach the end of the transcript | The non-dismissible `<VetDisclaimer/>` footer is always present and readable (cross-reference: presence itself is pinned by `check-result-snapshot.test.tsx`/`paywall-emergency-safety.test.tsx`, not re-asserted here) | `[DEVICE-ONLY]` | |

---

## How to run

**iOS (VoiceOver):** Settings → Accessibility → VoiceOver → On. Learn the
rotor (two-finger twist) to jump by Headings/Links. Single-tap to focus +
speak, double-tap to activate, swipe right/left to move focus forward/back.

**Android (TalkBack):** Settings → Accessibility → TalkBack → On. Explore by
touch (drag a finger to hear elements), swipe right/left to move focus,
double-tap to activate. Use the reading-controls menu (swipe up-then-right)
to jump by headings.

Run each flow above top to bottom, once per platform, on a device with
"Reduce Motion"/"Remove animations" **off**, then again with it **on** to
confirm the emergency/urgency surfaces stay identical in content (only
motion differs). Record results in the `Result:` column of the
`[DEVICE-ONLY]` rows only — never write a result for an `[AUTO]` row (its
result is whatever the named automated test reports in CI).

## Coverage

- **34 total steps** across the 5 flows (7 + 9 + 8 + 6 + 4).
- **16 `[AUTO]`-tagged rows** — their executable half is asserted by a
  named, passing test in `a11y-sweep.test.tsx` (cross-checked mechanically
  by `a11y-static-scan.test.ts`'s rule 4).
- **18 `[DEVICE-ONLY]`-tagged rows** — unfilled `Result:` column, a founder
  to-do on real hardware.

**The on-device VoiceOver/TalkBack pass has NOT been run in this
environment; it is a founder to-do on real hardware.** This document is the
procedure, not evidence that the procedure was executed.
