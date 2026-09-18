#!/bin/sh
# Golden gate (JS-006). Definition of done for every commit, see CLAUDE.md.
#
#   1. tsc --noEmit            zero type errors in src/
#   2. npm test                every test passed: 0 failed, 0 cancelled, 0 skipped, 0 todo
#
# `node --test` exits 0 when tests are skipped or marked todo, so the exit code
# is not enough: the summary lines are parsed. The gate FAILS CLOSED: if a
# summary line cannot be found (for example the reporter format changed after a
# Node upgrade) the gate fails instead of passing silently.
#
# POSIX sh, no dependencies. Run with `npm run check`.

set -u

fail() {
  echo ""
  echo "golden gate: FAILED - $1"
  exit 1
}

echo "== golden gate 1/2: tsc --noEmit"
npx tsc --noEmit || fail "type errors (tsc --noEmit)"
echo "ok"

echo ""
echo "== golden gate 2/2: npm test"
output=$(npm test 2>&1)
status=$?
printf '%s\n' "$output"
[ "$status" -eq 0 ] || fail "npm test exited with status $status"

# Summary lines look like "<marker> fail 0": three whitespace-separated fields.
# Matching on fields 2 and 3 avoids depending on the marker character or the locale.
# The last match wins, so a test name cannot shadow the real summary printed at the end.
summary_value() {
  printf '%s\n' "$output" | awk -v key="$1" 'NF == 3 && $2 == key && $3 ~ /^[0-9]+$/ { value = $3 } END { print value }'
}

tests=$(summary_value tests)
[ -n "$tests" ] || fail "summary line 'tests' not found in the test output (failing closed)"
[ "$tests" -gt 0 ] || fail "0 tests ran"

for key in fail cancelled skipped todo; do
  value=$(summary_value "$key")
  [ -n "$value" ] || fail "summary line '$key' not found in the test output (failing closed)"
  [ "$value" -eq 0 ] || fail "$value test(s) reported as '$key'; the gate requires 0"
done

echo ""
echo "golden gate: PASSED - tsc clean, $tests tests, 0 fail, 0 cancelled, 0 skipped, 0 todo"
