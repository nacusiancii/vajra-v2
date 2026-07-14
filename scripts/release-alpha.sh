#!/usr/bin/env bash
# Cut the next alpha from origin/main:
#   bump package.json → PR → wait for checks → squash-merge → tag
# Pushing the tag triggers build-win (Windows installer artifact).
#
# Usage (clean worktree, gh authenticated as someone who can merge):
#   pnpm release:alpha
set -euo pipefail

die() {
  echo "release:alpha: $*" >&2
  exit 1
}

command -v gh >/dev/null || die "gh CLI required"
command -v node >/dev/null || die "node required"
command -v git >/dev/null || die "git required"

if [ -n "$(git status --porcelain)" ]; then
  die "working tree not clean"
fi

gh auth status >/dev/null 2>&1 || die "gh is not authenticated (run: gh auth login)"

root=$(git rev-parse --show-toplevel)
cd "$root"

git fetch origin main

# Branch from latest main (works even if another worktree has main checked out).
git checkout -B release/alpha-wip origin/main

version=$(node scripts/bump-alpha-version.mjs)
tag="v${version}"
branch="release/${tag}"

if git ls-remote --exit-code --tags origin "refs/tags/${tag}" >/dev/null 2>&1; then
  die "tag ${tag} already exists on origin"
fi
if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  die "branch ${branch} already exists on origin"
fi

git branch -m "$branch"

git add package.json
git commit -m "chore(release): ${version}"
git push -u origin HEAD

gh pr create \
  --base main \
  --head "$branch" \
  --title "chore(release): ${version}" \
  --body "Alpha version bump for ${tag}. Squash-merged by \`pnpm release:alpha\` after checks pass; tag push triggers build-win."

pr=$(gh pr view --json number -q .number)
echo "release:alpha: waiting for checks on PR #${pr}..."

# gh exits 8 when no checks are registered yet.
for _ in $(seq 1 60); do
  set +e
  gh pr checks "$pr" >/dev/null 2>&1
  code=$?
  set -e
  if [ "$code" -ne 8 ]; then
    break
  fi
  sleep 5
done

gh pr checks "$pr" --watch
gh pr merge "$pr" --squash --delete-branch

git fetch origin main
git tag "$tag" origin/main
git push origin "$tag"

echo "release:alpha: tagged ${tag} on main — build-win should start from the tag push."
echo "release:alpha: watch: gh run watch --workflow=build-win.yml"
