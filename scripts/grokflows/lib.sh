#!/usr/bin/env bash
# Shared helpers for grokflow launchers. Source only — do not execute.
# shellcheck shell=bash

grokflows_repo_root() {
  CDPATH= cd -- "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

# Directory for this task's worktree: sibling of the main clone.
grokflows_worktree_path() {
  local slug="$1"
  local root
  root=$(grokflows_repo_root)
  echo "$(dirname "$root")/vajra-mt123-${slug}"
}

grokflows_branch() {
  local slug="$1"
  echo "mt123/${slug}"
}

# Tight allow-list for implement / fix agents (no blanket git * / gh *).
# shellcheck disable=SC2034
GROKFLOWS_IMPLEMENT_ALLOWS=(
  --allow "Edit"
  --allow "Write"
  --allow "Read"
  --allow "Grep"
  --allow "Bash(pnpm agent:check:autofix)"
  --allow "Bash(git status*)"
  --allow "Bash(git diff*)"
  --allow "Bash(git add *)"
  --allow "Bash(git commit *)"
  --allow "Bash(git push *)"
  --allow "Bash(git log *)"
  --allow "Bash(git rev-parse *)"
  --allow "Bash(git branch --show-current*)"
  --allow "Bash(gh pr create *)"
  --allow "Bash(gh pr view *)"
  --allow "Bash(gh pr edit *)"
  --allow "Bash(gh pr comment *)"
  --allow "Bash(ls *)"
  --allow "Bash(cat *)"
  --allow "Bash(head *)"
  --allow "Bash(tail *)"
  --allow "Bash(rg *)"
  --allow "Bash(mkdir *)"
  --allow "Bash(cp *)"
  --allow "Bash(mv *)"
  --allow "Bash(file *)"
  --allow "Bash(which *)"
  --allow "Bash(jq *)"
)

# Read-only review agents.
# shellcheck disable=SC2034
GROKFLOWS_REVIEW_ALLOWS=(
  --allow "Read"
  --allow "Grep"
  --allow "Bash(git status*)"
  --allow "Bash(git diff*)"
  --allow "Bash(git log *)"
  --allow "Bash(git rev-parse *)"
  --allow "Bash(git show *)"
  --allow "Bash(gh pr view *)"
  --allow "Bash(gh pr diff *)"
  --allow "Bash(gh pr checks *)"
  --allow "Bash(ls *)"
  --allow "Bash(cat *)"
  --allow "Bash(head *)"
  --allow "Bash(tail *)"
  --allow "Bash(rg *)"
  --allow "Bash(jq *)"
)

grokflows_run_headless() {
  local cwd="$1"
  local brief="$2"
  local max_turns="${3:-120}"
  shift 3
  # remaining: allow flags and optional extra grok flags
  local log="${cwd}/.grok-run.jsonl"

  if ! command -v grok >/dev/null 2>&1; then
    echo "grokflows: grok not on PATH (expected ~/.grok/bin/grok)" >&2
    return 127
  fi
  if [[ ! -f "$brief" ]]; then
    echo "grokflows: brief not found: $brief" >&2
    return 1
  fi

  echo "grokflows: cwd=$cwd brief=$brief max-turns=$max_turns log=$log" >&2
  # Intentionally no --always-approve / --yolo.
  # shellcheck disable=SC2086
  grok --prompt-file "$brief" \
    --cwd="$cwd" \
    --check \
    --no-subagents \
    --max-turns "$max_turns" \
    --output-format streaming-json \
    "$@" \
    >"$log" 2>&1
}
