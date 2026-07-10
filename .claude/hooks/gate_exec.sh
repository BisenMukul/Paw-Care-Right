#!/usr/bin/env bash
# SubagentStop gate for the executor: quality gates + scope + forbidden patterns + secrets.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

# FIX #3: active task from file, not env.
TASK=""
[ -f loop/current-task ] && TASK="$(tr -d ' \t\r\n' < loop/current-task)"
[ -z "$TASK" ] && TASK="${CURRENT_TASK:-}"
[ -z "$TASK" ] && { echo "gate_exec: no active task (loop/current-task empty)" >&2; exit 2; }

# Executor may legitimately declare the plan unimplementable.
[ -f "loop/plans/${TASK}.blocked.md" ] && exit 0

PLAN="loop/plans/${TASK}.plan.md"
[ -f "$PLAN" ] || { echo "gate_exec: missing ${PLAN}" >&2; exit 2; }

fail() { echo "gate_exec: $*" >&2; exit 2; }

# ---- 1. Quality gates. FIX #5: tolerate missing root package.json / undefined scripts during P0 bootstrap ----
if [ -f package.json ]; then
  for g in typecheck lint test build; do
    if grep -q "\"$g\"" package.json; then
      pnpm "$g" || fail "quality gate failed: pnpm $g"
    else
      echo "gate_exec: WARN root script '$g' not defined yet (P0 bootstrap)" >&2
    fi
  done
  if git diff HEAD --name-only 2>/dev/null | grep -q '^packages/ai/' && grep -q '"test:ai-evals"' package.json; then
    pnpm test:ai-evals || fail "quality gate failed: pnpm test:ai-evals (packages/ai touched)"
  fi
else
  echo "gate_exec: WARN no root package.json yet (P0 bootstrap) — quality gates skipped" >&2
fi

# ---- 2. Scope: every changed file must appear in the plan's file list (loop/ bookkeeping + .claude exempt) ----
# Use HEAD only if there is a commit; first-commit repos have no HEAD yet.
if git rev-parse HEAD >/dev/null 2>&1; then DIFF_BASE="HEAD"; else DIFF_BASE=""; fi
# Avoid a while|pipe subshell (its exit does NOT propagate — that would fail open).
CHANGED=$(
  { [ -n "$DIFF_BASE" ] && git diff "$DIFF_BASE" --name-only; git ls-files --others --exclude-standard; } | sort -u
)
OUT_OF_SCOPE=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in loop/*|.claude/*) continue ;; esac
  grep -qF "$f" "$PLAN" || OUT_OF_SCOPE="$OUT_OF_SCOPE $f"
done <<< "$CHANGED"
[ -n "$OUT_OF_SCOPE" ] && fail "out-of-scope file(s) changed (not in ${PLAN}):$OUT_OF_SCOPE"

# ---- 3. Forbidden patterns in added lines (CLAUDE.md §7/§8) ----
# NOTE: never do `echo … | grep … && fail` — `fail`'s exit runs in a pipe subshell and won't
# stop the script (fails open). Capture into a var, then test with an if-block.
# ADDED = added lines in tracked changes + full contents of new untracked files. The untracked
# part is essential during P0 bootstrap when there is no HEAD yet (git diff HEAD is empty then).
if [ -n "$DIFF_BASE" ]; then
  ADDED=$(git diff "$DIFF_BASE" --unified=0 | grep '^+' | grep -v '^+++' || true)
else
  ADDED=""
fi
# Append contents of untracked, non-ignored files (prefixed so patterns still match line bodies).
while IFS= read -r nf; do
  [ -z "$nf" ] && continue
  case "$nf" in loop/*|.claude/*) continue ;; esac
  [ -f "$nf" ] && ADDED="$ADDED"$'\n'"$(sed 's/^/+/' "$nf")"
done <<< "$(git ls-files --others --exclude-standard)"

if printf '%s\n' "$ADDED" | grep -qE '\bconsole\.log\('; then fail "forbidden: console.log"; fi
if printf '%s\n' "$ADDED" | grep -E '@ts-ignore' | grep -qv 'JUSTIFIED:'; then fail "forbidden: @ts-ignore without // JUSTIFIED:"; fi
if printf '%s\n' "$ADDED" | grep -qE ':[[:space:]]*any\b|as any\b'; then fail "forbidden: 'any' type"; fi
# 'diagnosis' wording is safety-sensitive; warn (do not hard-fail) to avoid false blocks in triage/eval code
if printf '%s\n' "$ADDED" | grep -iE '\bdiagnos(is|e|ed|ing)\b' | grep -qivE '(test|spec|eval|comment)'; then
  echo "gate_exec: WARN user-facing 'diagnosis' wording detected — checker must verify context (CLAUDE.md §7.1)" >&2
fi

# ---- 4. Secrets ----
if printf '%s\n' "$ADDED" | grep -qE '(sk-ant-|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----|(api[_-]?key|secret|password)[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9_/+-]{16,})'; then
  fail "possible secret in diff"
fi

exit 0
