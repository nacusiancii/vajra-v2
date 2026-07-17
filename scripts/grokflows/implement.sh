#!/usr/bin/env bash
# Phase 1 — implement one megathread task in an isolated worktree.
#
# Usage:
#   sh scripts/grokflows/implement.sh <slug> "<task line from #123>"
#   sh scripts/grokflows/implement.sh <slug> "<task line>" --max-turns 80
#   sh scripts/grokflows/implement.sh <slug> --resume   # re-run on existing worktree
#
# Creates ../vajra-mt123-<slug> on branch mt123/<slug> from origin/main when new.
# Writes .grok-brief.md, runs headless grok, streams log to .grok-run.jsonl.
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

ROOT=$(grokflows_repo_root)
SLUG="${1:?usage: implement.sh <slug> \"<task line>\" [--max-turns N] | implement.sh <slug> --resume}"
shift

RESUME=0
TASK_LINE=""
MAX_TURNS=120

while [[ $# -gt 0 ]]; do
  case "$1" in
    --resume)
      RESUME=1
      shift
      ;;
    --max-turns)
      MAX_TURNS="${2:?--max-turns needs a number}"
      shift 2
      ;;
    *)
      if [[ -z "$TASK_LINE" && "$1" != --* ]]; then
        TASK_LINE="$1"
        shift
      else
        echo "unknown arg: $1" >&2
        exit 2
      fi
      ;;
  esac
done

WT=$(grokflows_worktree_path "$SLUG")
BRANCH=$(grokflows_branch "$SLUG")
BRIEF="$WT/.grok-brief.md"
FOOTER="$SCRIPT_DIR/brief-footer.md"

if [[ "$RESUME" -eq 0 && -z "$TASK_LINE" ]]; then
  echo "usage: implement.sh <slug> \"<task line>\" [--max-turns N]" >&2
  exit 2
fi

if [[ ! -d "$WT" ]]; then
  if [[ "$RESUME" -eq 1 ]]; then
    echo "grokflows: worktree missing for --resume: $WT" >&2
    exit 1
  fi
  echo "grokflows: adding worktree $WT ($BRANCH)" >&2
  git -C "$ROOT" fetch origin main
  git -C "$ROOT" worktree add "$WT" -b "$BRANCH" origin/main
  (cd "$WT" && pnpm install)
elif [[ "$RESUME" -eq 0 ]]; then
  echo "grokflows: worktree already exists: $WT (use --resume to re-run)" >&2
  exit 1
fi

if [[ "$RESUME" -eq 0 || ! -f "$BRIEF" ]]; then
  if [[ -z "$TASK_LINE" ]]; then
    echo "grokflows: need task line to write brief" >&2
    exit 1
  fi
  {
    echo "# Task"
    echo "$TASK_LINE"
    echo
    cat "$FOOTER"
  } >"$BRIEF"
  echo "grokflows: wrote $BRIEF" >&2
fi

cd "$WT"
grokflows_run_headless "$WT" "$BRIEF" "$MAX_TURNS" "${GROKFLOWS_IMPLEMENT_ALLOWS[@]}"
echo "grokflows: implement finished (exit $?). Log: $WT/.grok-run.jsonl" >&2
