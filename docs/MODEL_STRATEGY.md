# MODEL_STRATEGY.md — Planner/Executor Model-Switching System

How **Paw Care Right +** runs its build loop across two model tiers: **Fable** as planner/advisor/checker (high-capability reasoning) and **Sonnet** as executor (fast, cheap, high-volume coding), with Fable supervising Sonnet's output after every task. This replaces the single-model maker/checker described in the original `LOOP_PROTOCOL.md §1`; that protocol's gates, milestones, and checkpoints all still apply — only *who does the work* changes.

---

## 1. Feasibility (verified, mid-2026 Claude Code)

This design uses only documented, stable Claude Code features — no experimental flags required:

| Capability we rely on | Status | Note |
|---|---|---|
| Per-subagent model via `model:` frontmatter (`fable`/`sonnet`/`opus`/`haiku`/full id) | **Stable** | Resolution order: `CLAUDE_CODE_SUBAGENT_MODEL` env → per-invocation → frontmatter → main model |
| `SubagentStop` hook fires when a subagent finishes, **before** its summary reaches the lead | **Stable** | The gate point for "Fable inspects after each part" |
| Hook can **block** and force continuation/revision (exit 2 or `decision:"block"`) | **Stable** | Gate on a real condition; return exit 0 when it clears |
| `prompt`-type hooks (LLM evaluates completion) and `agent`-type hooks (spawn a tool-using verifier) | `prompt` stable; `agent` marked experimental (May 2026), 60s timeout, ≤50 tool turns | We use `prompt`/`command` on the hot path; `agent` only for the milestone deep-review |
| Subagents start from **isolated, near-zero context**; only the delegation prompt crosses the boundary | **By design** | ⇒ plans MUST be written to disk, not held in context |
| `tools`/`disallowedTools` per subagent (least privilege) | **Stable** | Planner is read-only; executor writes; checker is read-only |
| `isolation: worktree`, `memory`, `maxTurns` frontmatter | **Stable (v2.1.198)** | Optional hardening (see §7) |

**Cost/latency reality:** multi-agent loops run ~4–7× the tokens of a single session. The planner/checker being Fable is where spend concentrates, so we keep **Sonnet on the high-volume executor** and make Fable's turns short and structured (read a diff, emit a verdict), not sprawling. Prompt caching absorbs much of the repeated-context cost.

## 2. Roles & model assignment

| Role | Model | Mode | Tools | Responsibility |
|---|---|---|---|---|
| **ORCHESTRATOR** (lead session) | Sonnet (cheap coordinator) | — | Task, Read, Bash(git) | Runs the loop, selects tasks, spawns planner→executor, applies checker verdict, commits, updates state. Does **not** design or write feature code itself. |
| **planner** (advisor) | **Fable** | read-only | Read, Grep, Glob | Turns one task card into an exact, ordered, file-level execution plan written to disk. The "define step-by-step process" brain. |
| **executor** (maker) | **Sonnet** | write | Read, Write, Edit, Bash, Grep, Glob | Implements the plan file step by step. No independent design decisions — follows the plan; if the plan is wrong, it stops and flags. |
| **checker** (surveillance) | **Fable** | read-only | Read, Grep, Glob, Bash(test/lint) | After the executor finishes, verifies the diff against the plan **and** the task card's acceptance criteria. Adversarial. PASS/FAIL only; never edits. |

Rationale: the expensive model is spent where judgment matters (decomposition + verification), the cheap fast model does the bulk keystrokes. This is the orchestrator-workers pattern with a high-tier reviewer.

## 3. Per-task loop (replaces LOOP_PROTOCOL §2 steps 5–7)

```
SELECT task (orchestrator, as before)
      │  orchestrator writes the task id to loop/current-task  (hooks read it from there;
      │  exported env does NOT reach Claude Code hooks — see model-strategy-setup.md)
      ▼
① PLAN  ── spawn planner (Fable) ─────────────────────────────
   delegation prompt = task id + card text + cited spec sections + repo pointers
   planner writes  loop/plans/<TASK>.plan.md  (schema §4) and returns a 3-line summary
      │
      ▼
② GATE-PLAN  (SubagentStop hook on agent type "planner")
   hooks/gate_plan.sh checks the plan file exists, matches schema, lists files+tests+ACs
   fail ⇒ block, planner revises. Max 2 plan revisions, else task → blocked.
      │
      ▼
③ EXECUTE ── spawn executor (Sonnet) ─────────────────────────
   delegation prompt = "Implement loop/plans/<TASK>.plan.md exactly. Follow CLAUDE.md.
                        Do only what the plan lists. If a step is impossible, stop and write
                        loop/plans/<TASK>.blocked.md explaining why — do not improvise."
   executor edits code + writes tests, runs local gates, returns summary
      │
      ▼
④ GATE-EXEC  (SubagentStop hook on agent type "executor")
   hooks/gate_exec.sh (deterministic): pnpm typecheck && lint && test && build (+ai-evals if packages/ai touched);
   scan diff for forbidden patterns (CLAUDE.md §7,§8) + out-of-scope files (not in plan's file list) + secrets
   fail ⇒ block with reasons appended as additionalContext, executor fixes forward. Max 3 exec attempts.
      │
      ▼
⑤ REVIEW ── spawn checker (Fable) ────────────────────────────
   delegation prompt = task card ACs + plan file + `git diff` (NOT the executor's reasoning)
   checker emits loop/reviews/<TASK>.review.md: per-AC evidence (file:line/test), safety scan, VERDICT pass|fail(reasons)
      │
      ▼
⑥ APPLY VERDICT (orchestrator)
   PASS ⇒ commit `type(scope): TASK short desc`; task→done; journal (planner+executor+checker refs); next task
   FAIL ⇒ feed checker reasons back to a fresh executor pass (step ③) with the SAME plan; ≤3 total; else task→blocked
```

Key invariants: the executor never reviews itself; the checker never fixes; Fable (planner) and Fable (checker) are **separate spawns** with separate context so the checker isn't biased by having written the plan. Safety Policy (`PRODUCT_SPEC §5`) and the `SAFETY-ESCALATION` rule still override everything.

## 4. Plan file schema (`loop/plans/<TASK>.plan.md`)

The plan is the *only* channel from planner to executor, so it must be self-contained:

```markdown
# Plan — <TASK_ID>: <title>
## Objective (from card)
<1–2 lines>
## Files to create/modify (exhaustive — executor may touch NOTHING else)
- path/a.ts — <what changes>
- path/a.spec.ts — <tests to add>
## Ordered steps
1. <concrete action, e.g. "add Zod schema X in packages/types/src/…">
2. …
## Tests to write (map to acceptance criteria)
- AC1 → <test name/file> — <what it asserts>
## Commands to run to self-verify
- pnpm --filter … test
## Interfaces/contracts (signatures, DTOs, schema shapes the executor must match)
## Out of scope / do NOT touch
## Risks & the ONE decision the planner made (so checker can scrutinize it)
```

`hooks/gate_plan.sh` rejects a plan missing the Files, Steps, Tests-to-AC, or Out-of-scope sections.

## 5. Concrete agent definitions (drop into `.claude/agents/`)

`.claude/agents/planner.md`
```yaml
---
name: planner
description: Use to produce the file-level execution plan for a single task card before any code is written. Fable-tier planning.
model: fable
tools: Read, Grep, Glob, Write   # Write is scoped to loop/plans/ only (enforced by block_protected_paths.sh)
disallowedTools: Edit, Bash
maxTurns: 20
---
You are the PLANNER (advisor) for the Paw Care Right + build loop.
Input: one task card (id + Do/Accept), cited spec sections, repo access (read-only).
Output: write loop/plans/<TASK>.plan.md following the schema in MODEL_STRATEGY.md §4, then return a ≤3-line summary.
Rules: Decompose into the smallest correct ordered steps. List EVERY file the executor may touch — it may touch no others. Map every acceptance criterion to a specific test. Make at most the minimum design decisions; state each one explicitly under "Risks" so the checker can scrutinize it. Never write code yourself. If the card is impossible/contradictory, write loop/plans/<TASK>.blocked.md instead and say so.
Safety: if the task could weaken any Safety Policy surface (PRODUCT_SPEC §5), do not plan it — write the blocked file tagged SAFETY-ESCALATION.
```

`.claude/agents/executor.md`
```yaml
---
name: executor
description: Use to implement an already-written plan file. Sonnet-tier high-volume coding. Never invoked without a plan.
model: sonnet
tools: Read, Write, Edit, Bash, Grep, Glob
maxTurns: 60
---
You are the EXECUTOR for the Paw Care Right + build loop.
Input: loop/plans/<TASK>.plan.md. Implement it EXACTLY and follow CLAUDE.md at all times.
Rules: Do only what the plan's steps and file list specify — touching any file not in the list is a failure. Write the tests the plan maps to each acceptance criterion, in the same change. Run pnpm typecheck && lint && test && build before returning. If a plan step is wrong or impossible, STOP and write loop/plans/<TASK>.blocked.md with the exact blocker — do NOT invent an alternative feature or soften safety copy.
Return: a short summary of files changed and gate results.
```

`.claude/agents/checker.md`
```yaml
---
name: checker
description: Use after the executor finishes to verify the diff against the plan and the task card acceptance criteria. Fable-tier adversarial review. Read-only.
model: fable
tools: Read, Grep, Glob, Bash, Write   # Write is scoped to loop/reviews/ only (enforced by block_protected_paths.sh)
disallowedTools: Edit
maxTurns: 25
---
You are the CHECKER (surveillance) for the Paw Care Right + build loop.
Input: the task card acceptance criteria, loop/plans/<TASK>.plan.md, and `git diff` — you do NOT receive the executor's reasoning.
Do: independently re-run pnpm typecheck && lint && test && build (+ pnpm test:ai-evals if packages/ai changed). Verify EACH acceptance criterion literally, quoting file:line or the test name as evidence. Scan the diff for forbidden patterns (CLAUDE.md §8), safety-content violations (CLAUDE.md §7), out-of-scope files (not in the plan's file list), and secrets.
Output: write loop/reviews/<TASK>.review.md ending with `VERDICT: pass` or `VERDICT: fail` + reasons[]. Never edit code — the executor fixes; you only judge.
```

## 6. Hooks (`.claude/settings.json` → `hooks`)

```jsonc
{
  "hooks": {
    "SubagentStop": [
      { "matcher": "planner",
        "hooks": [{ "type": "command", "command": ".claude/hooks/gate_plan.sh", "timeout": 20 }] },
      { "matcher": "executor",
        "hooks": [{ "type": "command", "command": ".claude/hooks/gate_exec.sh", "timeout": 900 }] }
    ],
    "PreToolUse": [
      { "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": ".claude/hooks/block_protected_paths.sh", "timeout": 10 }] }
    ]
  }
}
```

- `gate_plan.sh` — deterministic: plan file exists for the current task + has all required sections; else exit 2 with the missing-section list.
- `gate_exec.sh` — deterministic quality gate: runs the full command suite; greps the diff for `any`/`@ts-ignore`(unjustified)/`console.log`/secrets and for files outside the plan's file list; exit 2 with reasons on any failure (reasons come back as `additionalContext` so the executor can fix forward).
- `block_protected_paths.sh` — hard-blocks edits to `CLAUDE.md`, `LOOP_PROTOCOL.md`, `docs/MODEL_STRATEGY.md`, `docs/PHASES.md`, `docs/AI_PROVIDERS.md`, `docs/OTA_UPDATES.md`, `.claude/**`, and any `.env` (except `.env.example`). Mirrors CLAUDE.md §2 rule 6. **Parses the hook JSON with grep/sed — no `python`/`python3` dependency (the Microsoft Store python stub fails open) — and FAILS CLOSED if the target path cannot be determined.** This is also what confines the planner/checker `Write` to `loop/plans/` and `loop/reviews/`.

The milestone deep-review may optionally use an `agent`-type hook (Fable) for a broader cross-file audit — kept off the per-task hot path for cost.

## 7. Cost, safety & failure controls

- **Model routing knob:** `CLAUDE_CODE_SUBAGENT_MODEL` is left **unset** so each agent's frontmatter wins. To force an all-Sonnet cheap run (e.g. Fable access unavailable — see §8), set it to `sonnet`; to force all-Fable for a hard phase, set `fable`. One env var flips the whole strategy.
- **Fable-budget discipline:** planner and checker turns are short and structured; `maxTurns` caps runaway loops. If Fable planning for a task exceeds 2 revisions or the checker fails 3× → task blocked, no silent spend.
- **Isolation (optional):** set `isolation: worktree` on the executor when a phase has parallelizable independent-file tasks, to avoid collisions. v1 default is sequential (one task at a time) for simplicity.
- **Determinism first:** the *quality* gate (typecheck/lint/test/build/secret-scan) is a shell hook, not a model — models can't hallucinate it green. Fable's checker adds *semantic* verification (does the code match the plan's intent and the ACs) on top, which shell tests can't judge.
- **Safety supremacy unchanged:** any planner/executor/checker may raise `SAFETY-ESCALATION`; those blocks are never self-resolved. Publishing to production OTA remains human-only (OTA_UPDATES §8).

## 8. Fallback if Fable is unavailable

If your account/plan can't route `fable` in Claude Code, the system degrades cleanly: set planner and checker `model:` to `opus` (or `CLAUDE_CODE_SUBAGENT_MODEL=opus`) — the exact same architecture, one tier down. Executor stays `sonnet`. Nothing else changes; the plan-file contract and hooks are model-agnostic. The bundle ships with a `.claude/agents/*.opus.md` variant set for one-command swap (see `docs/model-strategy-setup.md`).
