#!/usr/bin/env bash
set -euo pipefail

branch_flag="${3:-0}"
[ "$branch_flag" = "1" ] || exit 0

main_worktree="$(git worktree list --porcelain | head -1 | sed 's/^worktree //')"
this_worktree="$(git rev-parse --show-toplevel)"

[ "$main_worktree" != "$this_worktree" ] || exit 0

seeded=0

for src in "$main_worktree"/.env*; do
  [ -f "$src" ] || continue
  name="$(basename "$src")"

  case "$name" in
    *.example) continue ;;
  esac

  dst="$this_worktree/$name"
  [ ! -f "$dst" ] || continue

  cp "$src" "$dst"
  echo "seeded $name"
  seeded=$((seeded + 1))
done

if [ "$seeded" -gt 0 ]; then
  echo "seeded $seeded env file(s) from main worktree"
fi
