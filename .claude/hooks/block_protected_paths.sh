#!/usr/bin/env bash
# PreToolUse (Edit|Write): hard-block edits to governance/secret files.
# FIX #2: do NOT depend on python3 (Microsoft Store stub fails open). Parse JSON with grep/sed,
# and FAIL CLOSED (exit 2) if we cannot determine the target path.
set -u
INPUT=$(cat)

# Extract tool_input.file_path without an interpreter.
# Matches "file_path":"...":  tolerant of whitespace; takes the first match.
FILE=$(printf '%s' "$INPUT" \
  | tr -d '\n' \
  | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"([^"\\]|\\.)*"' \
  | head -n1 \
  | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"//; s/"$//')

# Unescape common JSON escapes (\/ and \\) enough for path matching.
FILE=${FILE//\\\//\/}
FILE=${FILE//\\\\/\\}
# Normalize Windows backslashes to forward slashes.
FILE=${FILE//\\//}

# FIX #2: fail closed. If we could not extract a path, block rather than allow.
if [ -z "$FILE" ]; then
  # Only fail closed when the payload actually references a file tool; otherwise allow.
  if printf '%s' "$INPUT" | grep -q '"file_path"'; then
    echo "BLOCKED: could not parse file_path from hook input — failing closed (CLAUDE.md §2.6)" >&2
    exit 2
  fi
  exit 0
fi

# .env.example is the single sanctioned env file (T003 creates/updates it).
case "$FILE" in
  *.env.example) exit 0 ;;
esac

case "$FILE" in
  *CLAUDE.md|*LOOP_PROTOCOL.md|*docs/MODEL_STRATEGY.md|*docs/PHASES.md|*docs/AI_PROVIDERS.md|*docs/OTA_UPDATES.md|*/.claude/*|.claude/*|*.env|*.env.*)
    echo "BLOCKED: $FILE is a protected governance/secret path (CLAUDE.md §2.6)" >&2
    exit 2
    ;;
esac
exit 0
