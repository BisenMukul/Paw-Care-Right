#!/bin/sh
# T113 -- fingerprint generate + diff driver (OTA_UPDATES §1).
#
# What this does: generates the current-tree native fingerprint (via
# `@expo/fingerprint`) and diffs it against a caller-supplied baseline
# fingerprint JSON, printing the raw diff plus exactly one verdict line. Used
# both by the CI `mobile-fingerprint` job (per-PR, base-tree vs. head-tree)
# and by a local evidence run (pre-change vs. post-change).
#
# Why it exists: OTA_UPDATES §1 requires "CI computes and prints the
# fingerprint diff on every PR so this is never a surprise" -- a changed
# fingerprint means prior binaries can no longer receive an OTA update and a
# fresh store build is required. This script never fails because the
# fingerprint changed (that is a legitimate, expected event, D8 of the T113
# plan) -- it fails only on bad arguments or a tool failure.
#
# Usage:
#   sh scripts/fingerprint-diff.sh --base <fingerprint-json> [--platform ios|android] [--out-dir <dir>] [--dry-run]
set -eu

FINGERPRINT_VERSION="0.20.5"

BASE_FILE=""
PLATFORM="android"
OUT_DIR=""
DRY_RUN=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --)
      # Defense in depth: `pnpm run <script> -- --flag` forwards a literal
      # `--` to this script on some pnpm major versions (observed on pnpm
      # 10.34.3, the version this repo and CI pin) -- silently drop it rather
      # than rejecting it as an unknown argument, so the CI invocation form
      # is robust regardless of which side of that behavior the pinned pnpm
      # falls on.
      shift
      ;;
    --base)
      BASE_FILE="${2:-}"
      shift 2
      ;;
    --base=*)
      BASE_FILE="${1#--base=}"
      shift
      ;;
    --platform)
      PLATFORM="${2:-}"
      shift 2
      ;;
    --platform=*)
      PLATFORM="${1#--platform=}"
      shift
      ;;
    --out-dir)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    --out-dir=*)
      OUT_DIR="${1#--out-dir=}"
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    *)
      echo "fingerprint-diff: unknown argument '$1' -- usage: sh scripts/fingerprint-diff.sh --base <fingerprint-json> [--platform ios|android] [--out-dir <dir>] [--dry-run]" >&2
      exit 1
      ;;
  esac
done

case "$PLATFORM" in
  ios | android) ;;
  *)
    echo "fingerprint-diff: --platform must be one of ios|android (got '$PLATFORM')" >&2
    exit 1
    ;;
esac

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WORKSPACE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

print_plan() {
  echo "fingerprint-diff: ordered plan (platform: $PLATFORM)"
  echo "  1. resolve the @expo/fingerprint CLI (workspace node_modules, else pinned npx @expo/fingerprint@$FINGERPRINT_VERSION)"
  echo "  2. generate <out-dir>/current-$PLATFORM.json from the current tree"
  echo "  3. fingerprint:diff <base> <out-dir>/current-$PLATFORM.json"
  echo "  4. print the raw diff JSON, then the verdict line (UNCHANGED / CHANGED)"
  echo "fingerprint-diff: see docs/OTA_UPDATES.md §1 for why the CI job runs this on every PR."
}

if [ "$DRY_RUN" -eq 1 ]; then
  # Deterministic, offline, always exit 0 -- no network / no filesystem
  # writes in --dry-run mode.
  print_plan
  exit 0
fi

if [ -z "$BASE_FILE" ]; then
  echo "fingerprint-diff: --base <fingerprint-json> is required -- see the mobile-fingerprint job in .github/workflows/ci.yml for how CI produces it" >&2
  exit 1
fi

if [ ! -f "$BASE_FILE" ]; then
  echo "fingerprint-diff: --base file '$BASE_FILE' is not a readable file -- this script never performs a worktree install itself, see the mobile-fingerprint job in .github/workflows/ci.yml" >&2
  exit 1
fi

if [ -z "$OUT_DIR" ]; then
  OUT_DIR=$(mktemp -d)
fi
mkdir -p "$OUT_DIR"

CURRENT_FILE="$OUT_DIR/current-$PLATFORM.json"

cd "$WORKSPACE_DIR"

if node -e "require.resolve('@expo/fingerprint/bin/cli.js')" >/dev/null 2>&1; then
  FINGERPRINT_BIN=$(node -e "console.log(require.resolve('@expo/fingerprint/bin/cli.js'))")
  echo "fingerprint-diff: resolved @expo/fingerprint from workspace node_modules ($FINGERPRINT_BIN)"
  FINGERPRINT_CMD="node $FINGERPRINT_BIN"
else
  echo "fingerprint-diff: @expo/fingerprint not resolvable from workspace node_modules -- falling back to pinned npx @expo/fingerprint@$FINGERPRINT_VERSION"
  FINGERPRINT_CMD="npx --yes @expo/fingerprint@$FINGERPRINT_VERSION"
fi

echo "fingerprint-diff: generating current-tree fingerprint -> $CURRENT_FILE"
$FINGERPRINT_CMD fingerprint:generate --platform "$PLATFORM" > "$CURRENT_FILE"

echo "fingerprint-diff: diffing $BASE_FILE vs $CURRENT_FILE"
DIFF_JSON=$($FINGERPRINT_CMD fingerprint:diff "$BASE_FILE" "$CURRENT_FILE")
echo "$DIFF_JSON"

if [ "$DIFF_JSON" = "[]" ]; then
  echo "fingerprint-diff: UNCHANGED — OTA-eligible"
else
  echo "fingerprint-diff: CHANGED — store binary release required (OTA_UPDATES §1)"
fi
