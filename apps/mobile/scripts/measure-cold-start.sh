#!/bin/sh
# T095 plan step 13 -- adb cold-start sample driver.
#
# This measures a release-variant install on a physical device; it cannot
# run in CI or in the loop's container (no device/emulator is available
# there -- see docs/PERFORMANCE.md's Measurement log and loop/journal.md).
#
# This script only COLLECTS samples -- it does not own the pass/fail
# threshold. The single documented budget lives in
# `src/perf/cold-start.ts` (COLD_START_BUDGET_MS); a shell copy of that
# number would drift out of sync with the code, so this script deliberately
# never hardcodes 2500 and never prints PASS/FAIL. Paste the raw output into
# `evaluateColdStart` (or docs/PERFORMANCE.md's measurement log) by hand.
#
# Usage: sh scripts/measure-cold-start.sh [runs]
#   runs   number of force-stopped launches to sample (default 10)
set -eu

PKG="com.bombaypetcompany.app"
ACTIVITY="com.bombaypetcompany.app/.MainActivity"
RUNS="${1:-10}"

if ! command -v adb >/dev/null 2>&1; then
  echo "measure-cold-start: adb not found on PATH -- install the Android platform-tools and connect a physical mid-tier device." >&2
  exit 1
fi

echo "measure-cold-start: sampling ${RUNS} cold starts of ${PKG} (release variant install expected)"
echo "measure-cold-start: this is a physical-device measurement -- it cannot run in CI or this container."

i=1
while [ "$i" -le "$RUNS" ]; do
  adb shell am force-stop "$PKG"
  sleep 1

  echo "--- run ${i} ---"
  RAW_OUTPUT=$(adb shell am start -W -n "$ACTIVITY")
  if [ "$i" -eq 1 ]; then
    # Print the full raw block for at least the first run so the operator
    # has real evidence to paste into the journal / docs/PERFORMANCE.md.
    echo "$RAW_OUTPUT"
  else
    echo "$RAW_OUTPUT" | grep -E "TotalTime|WaitTime" || true
  fi

  TOTAL_TIME=$(echo "$RAW_OUTPUT" | awk -F': ' '/TotalTime/ {print $2}')
  echo "$TOTAL_TIME" >> /tmp/bombaypetcompany-cold-start-samples.$$

  adb shell am force-stop "$PKG"
  sleep 1
  i=$((i + 1))
done

echo "--- raw TotalTime samples (ms) ---"
cat /tmp/bombaypetcompany-cold-start-samples.$$

echo "--- informational median (NOT a pass/fail judgement -- see src/perf/cold-start.ts) ---"
sort -n /tmp/bombaypetcompany-cold-start-samples.$$ | awk '
  { a[NR] = $1 }
  END {
    if (NR % 2 == 1) {
      print a[(NR + 1) / 2]
    } else {
      print (a[NR / 2] + a[NR / 2 + 1]) / 2
    }
  }
'

rm -f /tmp/bombaypetcompany-cold-start-samples.$$
