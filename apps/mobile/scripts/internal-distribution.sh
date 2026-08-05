#!/bin/sh
# T101 plan step 9 -- internal-distribution driver for TestFlight-internal /
# Play-internal-track submission via the `preview` EAS profile.
#
# What this does: runs, in order, an `eas build` for iOS, an `eas build` for
# Android, then an `eas submit` for iOS, then Android -- all against the
# `preview` profile (internal distribution / internal Play track, see
# `apps/mobile/eas.json`). Preflight refuses early, before any network call
# that could burn EAS build minutes or fail late, if Expo credentials are
# missing or the git tree is dirty (this project's `eas.json` sets
# `cli.requireCommit: true`, so a dirty tree makes a real `eas build` fail
# late instead of early).
#
# Why it exists: T101's acceptance criteria require submission steps to be
# "executed as far as automatable", not merely documented. This script makes
# every `[AUTOMATED-READY]` step in `loop/checkpoint-C3-notes.md` literally
# runnable. It CANNOT complete a real build/submit in this container -- there
# is no `EXPO_TOKEN` / `eas login` session and no App Store Connect / Play
# Console credentials here (see `loop/checkpoint-C3-notes.md` section 7 for
# the verbatim evidence gathered while writing this script). A founder
# running this with real credentials is expected to get further than the
# preflight below.
#
# See loop/checkpoint-C3-notes.md for the full checklist this script is one
# step of.
#
# Usage: sh scripts/internal-distribution.sh [--dry-run] [--platform ios|android|all]
set -eu

PLATFORM="all"
DRY_RUN=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
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
    *)
      echo "internal-distribution: unknown argument '$1' -- usage: sh scripts/internal-distribution.sh [--dry-run] [--platform ios|android|all]" >&2
      exit 1
      ;;
  esac
done

case "$PLATFORM" in
  ios | android | all) ;;
  *)
    echo "internal-distribution: --platform must be one of ios|android|all (got '$PLATFORM')" >&2
    exit 1
    ;;
esac

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WORKSPACE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
EAS_JSON="$WORKSPACE_DIR/eas.json"

BUILD_IOS_CMD="npx eas-cli@latest build --profile preview --platform ios --non-interactive"
BUILD_ANDROID_CMD="npx eas-cli@latest build --profile preview --platform android --non-interactive"
SUBMIT_IOS_CMD="npx eas-cli@latest submit --profile preview --platform ios --non-interactive"
SUBMIT_ANDROID_CMD="npx eas-cli@latest submit --profile preview --platform android --non-interactive"

print_plan() {
  echo "internal-distribution: ordered plan (profile: preview, platform: $PLATFORM)"
  echo "  1. $BUILD_IOS_CMD"
  echo "  2. $BUILD_ANDROID_CMD"
  echo "  3. $SUBMIT_IOS_CMD"
  echo "  4. $SUBMIT_ANDROID_CMD"
  echo "internal-distribution: see loop/checkpoint-C3-notes.md sections 4-5 for the founder console steps each command depends on."
}

if [ "$DRY_RUN" -eq 1 ]; then
  # Deterministic, offline, always exit 0 -- no preflight that needs the
  # network runs in --dry-run mode.
  print_plan
  exit 0
fi

# --- Preflight (in order) ---

if [ ! -f "$EAS_JSON" ]; then
  echo "internal-distribution: eas.json not found at $EAS_JSON -- see loop/checkpoint-C3-notes.md section 3" >&2
  exit 1
fi

if [ -z "${EXPO_TOKEN:-}" ]; then
  if ! npx --yes eas-cli@latest whoami >/dev/null 2>&1; then
    echo "internal-distribution: no Expo credentials (set EXPO_TOKEN or run \`npx eas-cli@latest login\`) -- see loop/checkpoint-C3-notes.md section 3" >&2
    exit 1
  fi
fi

if [ -n "$(cd "$WORKSPACE_DIR/../.." && git status --porcelain)" ]; then
  echo "internal-distribution: git tree is dirty -- eas.json sets cli.requireCommit: true, commit or stash first -- see loop/checkpoint-C3-notes.md section 3" >&2
  exit 1
fi

# --- Real run: both builds, then both submits, in order ---

cd "$WORKSPACE_DIR"

case "$PLATFORM" in
  ios | all)
    echo "internal-distribution: running: $BUILD_IOS_CMD"
    $BUILD_IOS_CMD
    ;;
esac

case "$PLATFORM" in
  android | all)
    echo "internal-distribution: running: $BUILD_ANDROID_CMD"
    $BUILD_ANDROID_CMD
    ;;
esac

case "$PLATFORM" in
  ios | all)
    echo "internal-distribution: running: $SUBMIT_IOS_CMD"
    $SUBMIT_IOS_CMD
    ;;
esac

case "$PLATFORM" in
  android | all)
    echo "internal-distribution: running: $SUBMIT_ANDROID_CMD"
    $SUBMIT_ANDROID_CMD
    ;;
esac

echo "internal-distribution: builds/submits complete -- founder must still: create/confirm the TestFlight Internal Testing group and add testers (loop/checkpoint-C3-notes.md section 4), and confirm the Play internal tester list + opt-in URL (loop/checkpoint-C3-notes.md section 5)."
