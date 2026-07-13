#!/usr/bin/env sh
# Run one or more pnpm script names in parallel. Exit non-zero if any fails.
# Usage: sh scripts/run-parallel.sh lint typecheck test
set -u

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <pnpm-script> [pnpm-script...]" >&2
  exit 2
fi

pids=""
fail=0

for script in "$@"; do
  pnpm run "$script" &
  pids="$pids $!"
done

for pid in $pids; do
  # shellcheck disable=SC2086
  wait $pid || fail=1
done

exit "$fail"
