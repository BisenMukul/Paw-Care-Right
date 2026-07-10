# LOOP_PROTOCOL.md — Paw Care Right + Autonomous Build Loop

This file defines the loop's operating system. The agent running the loop **must not edit this file, CLAUDE.md, or docs/PHASES.md** (task status lives in `loop/loop-state.json`, not in the docs). One loop iteration = one task, end to end.

## 1. Roles

- **MAKER** — implements the current task exactly per its card + `CLAUDE.md`. Runs as a subagent with a fresh, focused context: task card, relevant spec/architecture sections, and the files it needs.
- **CHECKER** — a *separate* subagent, adversarial by default, that receives the task card and the diff — **not** the maker's reasoning. It verifies acceptance criteria literally, re-runs gates itself, and hunts for forbidden patterns. The checker's job is to find reasons to fail the task; passing is earned.
- **ORCHESTRATOR** — the top-level loop session: selects tasks, spawns maker/checker, updates state, commits, enforces milestone gates and checkpoints.

The maker never reviews its own work. The checker never fixes code (it reports; the maker fixes).

## 2. Iteration algorithm

```
1. LOAD    loop/loop-state.json, CLAUDE.md
2. HALT?   if state.status ∈ {paused, v1-complete} → stop
           if current phase's checkpoint is pending approval → write reminder to journal, stop
3. SELECT  next task in current phase where status=pending and all deps done
           (if none and all phase tasks done → run MILESTONE GATE §6)
           (if none but blocked tasks exist → attempt oldest blocked if its blocker note is resolved, else stop with BLOCKED summary)
4. MARK    task → in_progress, attempts += 1
5. MAKER   implement per task card; follow CLAUDE.md §8 Definition of Done;
           run locally: pnpm typecheck && pnpm lint && pnpm test (+ test:ai-evals if packages/ai touched) && pnpm build (affected)
6. CHECKER fresh subagent: given task card + git diff + repo access
           a) re-run the same gates independently
           b) verify EVERY acceptance criterion literally (quote evidence: file/line/test name)
           c) forbidden-pattern scan (CLAUDE.md §8) + safety rules scan (CLAUDE.md §7) on the diff
           d) verdict: PASS | FAIL(reasons[])
7a. PASS   commit `type(scope): Txxx title` (one commit; include tests+docs);
           task → done; append journal entry (§4); goto 1
7b. FAIL   if attempts < 3: feed checker reasons to a fresh MAKER pass (fix-forward, no reverts unless checker says revert); goto 6
           else: task → blocked with checker reasons in state.notes + journal; goto 1 (next task)
```

Hard rules: never `git push` inside an iteration (only at milestone gates) · never skip the checker · never mark done with any red gate · never modify unrelated files "while there" (checker fails scope creep).

## 3. Context discipline

- Maker context per task: the task card, CLAUDE.md, the specific `docs/` sections the card cites, and targeted file reads. Do not paste whole documents when a section suffices.
- Long files: read with ranges; edit surgically.
- If the maker discovers the task card is wrong/impossible as written: do **not** improvise a different feature. Mark blocked with a precise note proposing the card amendment; the founder amends PHASES.md (agent never does).

## 4. Journal format (`loop/journal.md`, append-only)

```
## [2026-07-08T14:02Z] T023 · Photo upload pipeline — DONE (attempt 1)
- Commit: a1b2c3d feat(pets): T023 presigned photo upload + image worker
- Checker evidence: AC1 ✅ apps/api/test/photos.e2e.ts:41 · AC2 ✅ exif stripped (test:worker) · gates ✅
- Notes: sharp pinned 0.33.x (justification: …)
```
Blocked entries include the checker's failure reasons verbatim. Milestones and checkpoints get their own entries.

## 5. State file contract (`loop/loop-state.json`)

- `status`: `running | paused | v1-complete`
- `currentPhase`: `P0..P11`
- `tasks[Txxx]`: `{status: pending|in_progress|done|blocked, attempts, notes?}`
- `milestones[Mx]`: `{status: pending|passed, taggedAt?}`
- `checkpoints[C1|C2|C3]`: `{afterMilestone, approved: bool, approvedBy?, note?}` — **only the founder flips `approved`**.
The orchestrator is the only writer. Any manual founder edit is a valid input on next load.

## 6. Milestone gate (end of each phase)

```
1. Full suite: pnpm typecheck && pnpm lint && pnpm test && pnpm build
2. pnpm test:ai-evals (from M3 onward) — thresholds must pass
3. Zero in_progress tasks; blocked tasks require founder note "accepted-deferral" in state, else gate fails
4. Coverage gate holds (from M1: ≥80% api services; from M3: + packages/ai)
5. Milestone journal entry: phase summary, metrics (tests count, coverage, eval scores), deferrals
6. git tag milestone/MX && git push origin main --tags
7. If phase has a checkpoint → write loop/checkpoint-<id>-notes.md (what the founder must do, exact commands/links) → set status=paused
8. Else → currentPhase = next, continue
```

## 7. Failure & anomaly handling

- **3 consecutive tasks blocked** → stop, write `loop/NEEDS_ATTENTION.md` with a synthesis (common cause analysis), status=paused.
- **Gate flakiness** (test passes/fails nondeterministically) → task is not done; open a `fix(test):` micro-task inline (counts as same task attempt) — flaky tests are defects.
- **Dependency/install failures** → journal exact error; try lockfile-respecting resolution only; never mass-upgrade to "fix" one package.
- **AI eval regression at a gate** → the gate fails even if code tests pass. Bisect prompt/rules changes since last green report; safety thresholds are absolute.
- **Anything requiring real secrets/store consoles/legal judgment** → that's checkpoint material, never improvised.

## 8. Safety escalation (overrides everything)

If at any point the agent believes a change could weaken the Safety Policy (SPEC §5) — e.g., a task seems to require softening disclaimers, adding dosage output, or bypassing the red-flag layer — it stops that task, marks blocked with tag `SAFETY-ESCALATION`, and moves on. These blocks are never self-resolved.

## 9. Founder controls (cheat sheet)

- Pause: set `status: paused`. Resume: `running`.
- Approve checkpoint: `checkpoints.Cx.approved = true` (+ note).
- Accept a deferral: add `"accepted-deferral"` to the blocked task's notes.
- Re-scope a task: edit its card in `docs/PHASES.md`, set task status back to `pending`, clear notes.
