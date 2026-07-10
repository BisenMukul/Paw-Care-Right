# Model Strategy — Setup & Operation

Quick guide to running the Fable-planner / Sonnet-executor / Fable-checker loop. Full design is in `docs/MODEL_STRATEGY.md`.

## Prerequisites
- Claude Code v2.1.198+ (per-subagent `model:`, SubagentStop hooks, background subagents).
- An account/plan that can route the `fable` model in Claude Code. If not, use the Opus fallback below — identical architecture, one tier down.
- `python3`, `bash`, `git`, `pnpm` on PATH (hooks use them).

## What ships in the bundle
```
.claude/
├── agents/
│   ├── planner.md      (model: fable, read-only)   + planner.opus.md
│   ├── executor.md     (model: sonnet, writes)
│   └── checker.md      (model: fable, read-only)   + checker.opus.md
├── hooks/
│   ├── gate_plan.sh            (SubagentStop: planner — validates plan file)
│   ├── gate_exec.sh            (SubagentStop: executor — quality+scope+secret gate)
│   └── block_protected_paths.sh(PreToolUse: Edit|Write — protects governance files)
└── settings.json               (wires the hooks)
loop/plans/     (planner writes <TASK>.plan.md here)
loop/reviews/   (checker writes <TASK>.review.md here)
```

## Run it
1. `chmod +x .claude/hooks/*.sh` (already set, re-run after clone if needed).
2. Start Claude Code in the repo root. Run `/agents` and confirm planner/executor/checker are listed (project scope). If they don't appear, restart the session once (agents created before a session started need a reload).
3. Paste `loop/KICKOFF_PROMPT.md`. The orchestrator (run this session on Sonnet to keep coordination cheap) drives planner→executor→checker per task.

## The one manual coupling: loop/current-task
The hooks need to know which task is active to find the right plan/review file. **Claude Code hooks do not reliably inherit the orchestrator's exported shell env**, so an `export CURRENT_TASK=…` never reaches them. Instead, the orchestrator writes the active task id to the file `loop/current-task` at the start of each task (it's under `loop/`, which the loop agent is allowed to write). The three hooks read that file. If you drive the loop from your own `loop.sh` runner, `echo T012 > loop/current-task` before spawning the planner. (An env var `CURRENT_TASK` is still honored as a fallback if the file is absent.)

## Switching model tiers (one knob)
- **Force all subagents to one model** (ignores frontmatter): `export CLAUDE_CODE_SUBAGENT_MODEL=sonnet` (cheap run) or `=fable` / `=opus`. Unset to let each agent's frontmatter decide (the default, and what you normally want).
- **Fable unavailable → Opus fallback:** swap the planner/checker definitions:
  ```bash
  cp .claude/agents/planner.opus.md .claude/agents/planner.md
  cp .claude/agents/checker.opus.md .claude/agents/checker.md
  ```
  Executor stays Sonnet. Nothing else changes.

## Cost expectations
Multi-agent loops cost ~4–7× the tokens of a single-agent session; the Fable planner+checker turns are where spend concentrates, so they're deliberately short and structured. Prompt caching absorbs repeated context. If a phase is mechanical (scaffolding, config), consider `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` for that phase and switch back to Fable for logic-heavy phases (P3 AI core, P4 checks, P7 billing).

## Verifying the gates work (smoke test before trusting the loop)
- Break a rule on purpose in a scratch branch: add `console.log('x')` to a plan-listed file and let the executor finish → `gate_exec.sh` should block with "forbidden pattern".
- Delete a required section from a plan file → `gate_plan.sh` should block.
- Ask any agent to edit `CLAUDE.md` → `block_protected_paths.sh` should block.
Run these once after cloning; if all three block as expected, the surveillance layer is live.
