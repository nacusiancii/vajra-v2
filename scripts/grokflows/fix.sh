#!/usr/bin/env bash
# Phase 2 follow-up — implement interactive review feedback on an existing worktree.
#
# Usage:
#   sh scripts/grokflows/fix.sh <slug> /path/to/feedback.md
#   sh scripts/grokflows/fix.sh <slug> /path/to/feedback.md --max-turns 80
#
# feedback.md should list only accepted blockers from the interactive audit session.
# Reuses the same tight allow-list as implement.sh.
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

SLUG="${1:?usage: fix.sh <slug> <feedback.md> [--max-turns N]}"
FEEDBACK="${2:?usage: fix.sh <slug> <feedback.md> [--max-turns N]}"
shift 2

MAX_TURNS=80
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-turns)
      MAX_TURNS="${2:?}"
      shift 2
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

WT=$(grokflows_worktree_path "$SLUG")
BRIEF="$WT/.grok-fix-brief.md"
FOOTER="$SCRIPT_DIR/brief-footer.md"

if [[ ! -d "$WT" ]]; then
  echo "grokflows: worktree not found: $WT" >&2
  exit 1
fi
if [[ ! -f "$FEEDBACK" ]]; then
  echo "grokflows: feedback file not found: $FEEDBACK" >&2
  exit 1
fi

{
  echo "# Task"
  echo "Implement only the accepted review feedback below for mt123/${SLUG}. No new scope."
  echo
  echo "# Feedback (authoritative)"
  cat "$FEEDBACK"
  echo
  cat "$FOOTER"
} >"$BRIEF"

echo "grokflows: wrote $BRIEF" >&2
grokflows_run_headless "$WT" "$BRIEF" "$MAX_TURNS" "${GROKFLOWS_IMPLEMENT_ALLOWS[@]}"
echo "grokflows: fix finished (exit $?). Log: $WT/.grok-run.jsonl" >&2
