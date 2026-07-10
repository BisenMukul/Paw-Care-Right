# Paw Care Right + — Autonomous Build Bundle

AI pet care companion (B2C, global, subscription). This folder is a **repo seed**: drop its contents into a fresh git repository and hand it to your Claude Code loop runner.

## What's inside
| Path | Purpose |
|---|---|
| `CLAUDE.md` | Project constitution — stack lock, standards, safety rules, Definition of Done |
| `LOOP_PROTOCOL.md` | The loop OS — maker/checker roles, iteration algorithm, milestone gates, checkpoints |
| `docs/PRODUCT_SPEC.md` | Full v1 product spec incl. Safety Policy (§5) and AI Triage Engine (§6) |
| `docs/ARCHITECTURE.md` | Build-ready HLD: containers, data model, API surface, queues, sequences |
| `docs/PHASES.md` | 12 phases · 118 task cards with testable acceptance criteria |
| `loop/loop-state.json` | Machine state (task statuses, milestones, checkpoints) |
| `loop/KICKOFF_PROMPT.md` | The exact first message for the orchestrator session |
| `loop/journal.md` | Append-only build log (starts empty) |

## Naming
- **Display name (users see this):** `Paw Care Right +`
- **Technical identifiers (code/config/URLs):** `pawcareright`, bundle id `com.pawcareright.app`, deep-link `pawcareright://` — the `+` and spaces are illegal in these contexts. See `CLAUDE.md §1a`. The store name + bundle id are confirmed at checkpoint C3 after the T102 trademark pass; treat as provisional until then.

## What to do after you download this file

1. **Unzip and create the repo.**
   `unzip pawcareright-loop-bundle.zip && cd pawcareright`
   `git init && git add -A && git commit -m "chore: seed Paw Care Right + loop bundle"`
   Create an empty repo on your Git host and `git remote add origin … && git push -u origin main`.
2. **Prep the machine** (see Prerequisites below): Node 22 + pnpm, Docker running, `ANTHROPIC_API_KEY` exported for real AI-eval runs.
3. **Start the loop.** Open Claude Code in the repo root and paste the contents of `loop/KICKOFF_PROMPT.md` as your first message — or wire that prompt into your existing TrackForge/ToonForge runner (`loop.sh` heartbeat, same maker/checker pattern). The orchestrator reads `CLAUDE.md` → `LOOP_PROTOCOL.md` → `loop/loop-state.json` and starts at T001.
4. **Watch the milestones.** It commits per task, pushes only at `milestone/M0…M11` tags, and writes progress to `loop/journal.md`. You can `git pull` anytime to review.
5. **Handle the three checkpoints** when it pauses (details below). These are the only points that need you.
6. **Resume** after each checkpoint by setting `checkpoints.Cx.approved = true` in `loop/loop-state.json` (+ a journal note) and setting `status: running`.

It will pause automatically at the three human checkpoints:
   - **C1 (after M3):** review AI eval report — ideally with a veterinarian's read of the golden set — before the triage engine gets user-facing wiring.
   - **C2 (after M7):** configure store products per `docs/store-setup.md`, run the billing sandbox checklist, approve pricing.
   - **C3 (after M10):** final app name + bundle ids, store consoles, legal-review markers, hotline verification, TestFlight/Play submission.

## Founder cheat sheet
Pause/resume, checkpoint approval, deferrals, and re-scoping: see `LOOP_PROTOCOL.md §9`. The loop never edits its own governing docs — you do.

## Prerequisites the loop expects on the machine
Node 22 + pnpm, Docker (postgres/redis/minio via compose), git with push access, `ANTHROPIC_API_KEY` in env for real AI-eval runs (CI uses a fake provider otherwise). Store/RevenueCat/Sentry/PostHog keys are only needed from Phase 7 onward and are requested via checkpoint notes, never hardcoded.
