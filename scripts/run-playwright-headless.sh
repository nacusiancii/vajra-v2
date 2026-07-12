#!/usr/bin/env sh
# Headless Playwright runner (Xvfb + force X11). Used by test:smoke:headless.
# For visible Electron windows while debugging: pnpm test:smoke.
#
# On Wayland desktops, Electron/Chromium prefers WAYLAND_DISPLAY over Xvfb's
# DISPLAY and still flashes real windows. Strip Wayland and pin the X11
# backend so the virtual framebuffer is the only surface.
set -e

if ! command -v xvfb-run >/dev/null 2>&1; then
  echo "error: xvfb-run is required for headless smoke tests." >&2
  echo "       Install: sudo apt install xvfb" >&2
  echo "       Or run with a visible UI: pnpm test:smoke" >&2
  exit 1
fi

exec xvfb-run -a env \
  -u WAYLAND_DISPLAY \
  -u WAYLAND_SOCKET \
  VAJRA_SMOKE_HEADLESS=1 \
  XDG_SESSION_TYPE=x11 \
  GDK_BACKEND=x11 \
  QT_QPA_PLATFORM=xcb \
  ELECTRON_OZONE_PLATFORM_HINT=x11 \
  playwright test "$@"
