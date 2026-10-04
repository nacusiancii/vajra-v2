#!/usr/bin/env sh
# Screenshot harness (#106): build the app, boot it on the smoke fixture, open a
# route, write a PNG an agent can Read() back.
#
# Usage:
#   pnpm screenshot                 # Home → screenshots/home.png
#   pnpm screenshot /sale /settings # one PNG per route, one build
#
# Env:
#   VAJRA_SKIP_BUILD=1              reuse out/ from a previous build
#   VAJRA_SCREENSHOT_VIEWPORT=WxH   window content size (default 1366x768)
#   VAJRA_SCREENSHOT_WAIT=<testid>  wait for this testid instead of the view root
#   VAJRA_SCREENSHOT_DIR=<path>     output folder (default ./screenshots, gitignored)
#
# Headless under Xvfb when xvfb-run exists (same wrapper as test:smoke:headless);
# otherwise a visible Electron window opens briefly.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

routes=${*:-/}
for r in $routes; do
  case $r in
    /*) ;;
    *)
      echo "error: routes must start with '/', got '$r'" >&2
      exit 2
      ;;
  esac
done

if [ "${VAJRA_SKIP_BUILD:-}" != "1" ]; then
  pnpm exec electron-vite build
fi

export VAJRA_SCREENSHOT_ROUTES="$routes"

if command -v xvfb-run >/dev/null 2>&1; then
  exec sh scripts/run-playwright-headless.sh --config playwright.screenshot.config.ts
fi

echo "warn: xvfb-run not found; opening a visible Electron window (install xvfb for headless)." >&2
exec pnpm exec playwright test --config playwright.screenshot.config.ts
