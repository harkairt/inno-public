#!/bin/bash

# Claude Code Stop Hook: ESLint Changed Files
# This hook runs after Claude finishes responding and blocks if there are lint errors
# in files that have been modified (tracked by git).
# Claude will receive the errors and work on resolving them.
#
# Exit codes:
#   0 - Allow stop (lint passed or already in continuation)
#   2 - Block stop and feed errors to Claude via stderr

# Read hook input from stdin
INPUT=$(cat)

# Check if stop_hook_active is true - prevents infinite loops
# When Claude continues due to our block, this flag will be true
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
    # Already in a continuation loop, allow stop to prevent infinite recursion
    exit 0
fi

# Change to project directory if available
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
    cd "$CLAUDE_PROJECT_DIR"
fi

# Get changed files (staged + unstaged + untracked, excluding deleted)
# Then filter to only lintable file extensions
CHANGED_FILES=$(
    {
        git diff --name-only --diff-filter=d HEAD 2>/dev/null
        git diff --name-only --diff-filter=d --cached HEAD 2>/dev/null
        git ls-files --others --exclude-standard 2>/dev/null
    } | sort -u | grep -E '\.(ts|tsx|js|jsx|vue|mjs|cjs)$'
)

if [ -z "$CHANGED_FILES" ]; then
    # No lintable files changed, allow stop
    exit 0
fi

# Run eslint on all changed files
ESLINT_OUTPUT=$(echo "$CHANGED_FILES" | xargs npx eslint --no-warn-ignored 2>&1) || ESLINT_EXIT_CODE=$?
ESLINT_EXIT_CODE=${ESLINT_EXIT_CODE:-0}

if [ "$ESLINT_EXIT_CODE" -eq 0 ]; then
    # No lint errors, allow Claude to stop
    echo '{"systemMessage": "✅ `npx eslint` passed on changed files"}'
    exit 0
else
    # Lint errors found - block the stop and feed errors back to Claude
    cat >&2 <<EOF
ESLint found errors in changed files. Please fix the following:

$ESLINT_OUTPUT

Review the errors above and make the necessary corrections to resolve all lint issues.
EOF

    exit 2
fi
