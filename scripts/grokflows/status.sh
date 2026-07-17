#!/usr/bin/env bash
# Fleet dashboard for mt123 worktrees and PRs.
# Usage: sh scripts/grokflows/status.sh
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

ROOT=$(grokflows_repo_root)
PARENT=$(dirname "$ROOT")

echo "=== mt123 worktrees under $PARENT ==="
shopt -s nullglob
for d in "$PARENT"/vajra-mt123-*; do
  slug=${d##*/vajra-mt123-}
  branch=$(grokflows_branch "$slug")
  echo
  echo "--- $slug ($d) ---"
  if git -C "$d" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$d" log -1 --oneline 2>/dev/null || true
    git -C "$d" status -sb 2>/dev/null || true
  else
    echo "(not a git worktree)"
  fi
  if command -v gh >/dev/null 2>&1; then
    gh pr list --repo "$(git -C "$ROOT" remote get-url origin | sed -E 's#.*github.com[:/](.+)(\.git)?#\1#;s/\.git$//')" \
      --head "$branch" --json number,title,isDraft,url,statusCheckRollup \
      --jq '.[] | "#\(.number) draft=\(.isDraft) \(.title) \(.url)"' 2>/dev/null || true
  fi
done
echo
echo "=== done ==="
