#!/usr/bin/env sh
# Headless Playwright runner (Xvfb). Used by test:smoke:headless.
# For visible Electron windows while debugging: pnpm test:smoke.
set -e

if ! command -v xvfb-run >/dev/null 2>&1; then
  echo "error: xvfb-run is required for headless smoke tests." >&2
  echo "       Install: sudo apt install xvfb" >&2
  echo "       Or run with a visible UI: pnpm test:smoke" >&2
  exit 1
fi

exec xvfb-run -a playwright test "$@"
