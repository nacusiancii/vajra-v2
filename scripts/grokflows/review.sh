#!/usr/bin/env bash
# Optional dual review — read-only headless pass on a draft PR.
# Primary Phase 2 path is an *interactive* audit session; use this only if you
# want a second mechanical pass.
#
# Usage:
#   sh scripts/grokflows/review.sh <slug> <pr-number> [reviewer-id]
# reviewer-id defaults to 1; run twice with 1 and 2 for dual review.
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

SLUG="${1:?usage: review.sh <slug> <pr-number> [reviewer-id]}"
PR="${2:?usage: review.sh <slug> <pr-number> [reviewer-id]}"
RID="${3:-1}"
MAX_TURNS=40

WT=$(grokflows_worktree_path "$SLUG")
if [[ ! -d "$WT" ]]; then
  echo "grokflows: worktree not found: $WT (checkout PR branch there first)" >&2
  exit 1
fi

BRIEF="$WT/.grok-review-${RID}-brief.md"
TASK_LINE="(see PR #${PR})"
if [[ -f "$WT/.grok-brief.md" ]]; then
  TASK_LINE=$(awk '/^# Task$/{getline; print; exit}' "$WT/.grok-brief.md")
fi

cat >"$BRIEF" <<EOF
# Task
Read-only review of PR #${PR} for megathread #123 task: ${TASK_LINE}

# Do
- \`gh pr view ${PR}\` and \`gh pr diff ${PR}\` (or git diff main...HEAD in the worktree).
- Valid feedback only: correctness, CONTEXT.md domain, money/stock invariants, void/walk-in/credit edges, missing behaviour for the single task line.
- Drop pure style nits (lint/format already ran via agent:check:autofix).
- Output markdown only:
  ## Blockers
  ## Optional
  ## LGTM (yes/no)

# Do not
- Edit files, commit, push, approve, or merge.
- Expand scope beyond the task line.

# Stop
Print the review markdown. STOP.
EOF

# Reviewers must not write code — drop Edit/Write by using review allows only.
grokflows_run_headless "$WT" "$BRIEF" "$MAX_TURNS" "${GROKFLOWS_REVIEW_ALLOWS[@]}"
echo "grokflows: review ${RID} finished. Log: $WT/.grok-run.jsonl" >&2
# Also copy last assistant-ish output hint
echo "grokflows: read the log or re-run with less redirection if you need the summary in-terminal." >&2
