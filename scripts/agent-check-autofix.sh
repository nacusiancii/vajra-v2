#!/usr/bin/env sh
# Shared quality gate for parallel grokflow agents.
# Serialises via flock so multiple worktrees do not thrash the machine.
# Usage: sh scripts/agent-check-autofix.sh
#        pnpm agent:check:autofix
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

LOCK_DIR="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}"
LOCK="$LOCK_DIR/vajra-agent-check-autofix.lock"

# flock may be util-linux (preferred) or busybox; fail loudly if missing.
if ! command -v flock >/dev/null 2>&1; then
  echo "agent-check-autofix: flock not found — install util-linux" >&2
  exit 127
fi

flock "$LOCK" sh -c '
  set -eu
  pnpm lint:fix
  pnpm format
  pnpm typecheck
'
