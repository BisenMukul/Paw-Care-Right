#!/usr/bin/env bash
# SubagentStop gate for the planner: plan file exists + has required sections.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

# FIX #3: hooks do NOT inherit the orchestrator's exported env reliably.
# Source of truth for the active task is the file loop/current-task (orchestrator writes it).
TASK=""
[ -f loop/current-task ] && TASK="$(tr -d ' \t\r\n' < loop/current-task)"
[ -z "$TASK" ] && TASK="${CURRENT_TASK:-}"   # env as fallback only
if [ -z "$TASK" ]; then
  echo "gate_plan: no active task — write the task id to loop/current-task before spawning the planner" >&2
  exit 2
fi

# A deliberate block file is a valid planner outcome (task blocked, not gate failure).
[ -f "loop/plans/${TASK}.blocked.md" ] && exit 0

PLAN="loop/plans/${TASK}.plan.md"
if [ ! -f "$PLAN" ]; then
  echo "gate_plan: missing ${PLAN}" >&2
  exit 2
fi

missing=""
grep -qiE '^## *Files to create/modify' "$PLAN" || missing="$missing Files-to-create/modify;"
grep -qiE '^## *Ordered steps'          "$PLAN" || missing="$missing Ordered-steps;"
grep -qiE '^## *Tests to write'         "$PLAN" || missing="$missing Tests-to-write;"
grep -qiE '^## *Out of scope'           "$PLAN" || missing="$missing Out-of-scope;"

if [ -n "$missing" ]; then
  echo "gate_plan: ${PLAN} missing required section(s):${missing} (schema: MODEL_STRATEGY.md §4)" >&2
  exit 2
fi
exit 0
