#!/usr/bin/env sh
# Headless Playwright runner (Xvfb + force X11). Used by test:smoke:headless.
# For visible Electron windows while debugging: pnpm test:smoke.
#
# On Wayland desktops, Electron/Chromium prefers WAYLAND_DISPLAY over Xvfb's
# DISPLAY and still flashes real windows. Strip Wayland and pin the X11
# backend so the virtual framebuffer is the only surface.
#
# Pin the framebuffer size: xvfb-run's default differs per distro (Debian/Ubuntu
# 1280x1024, Arch 640x480) and the app opens maximized to it. At 640x480 dialog
# submit buttons sit outside the viewport and clicks time out. Likewise pin the
# UI scale: HiDPI desktops export GDK_SCALE=2, which Chromium honours under Xvfb
# and halves the effective viewport (and doubles screenshot pixel size).
set -e

XVFB_SCREEN="${VAJRA_XVFB_SCREEN:-1366x768x24}"

if ! command -v xvfb-run >/dev/null 2>&1; then
  echo "error: xvfb-run is required for headless smoke tests." >&2
  echo "       Install: sudo apt install xvfb" >&2
  echo "       Or run with a visible UI: pnpm test:smoke" >&2
  exit 1
fi

exec xvfb-run -a -s "-screen 0 $XVFB_SCREEN" env \
  -u WAYLAND_DISPLAY \
  -u WAYLAND_SOCKET \
  VAJRA_SMOKE_HEADLESS=1 \
  GDK_SCALE=1 \
  GDK_DPI_SCALE=1 \
  XDG_SESSION_TYPE=x11 \
  GDK_BACKEND=x11 \
  QT_QPA_PLATFORM=xcb \
  ELECTRON_OZONE_PLATFORM_HINT=x11 \
  playwright test "$@"
