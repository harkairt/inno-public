#!/bin/bash

# Claude Code Stop Hook: Nuxt TypeScript Type Checking
# This hook runs after Claude finishes responding and blocks if there are type errors.
# Claude will receive the errors and work on resolving them.
#
# Exit codes:
#   0 - Allow stop (typecheck passed or already in continuation)
#   2 - Block stop and feed errors to Claude via stderr

# Read hook input from stdin
INPUT=$(cat)

# Check if stop_hook_active is true - prevents infinite loops
# When Claude continues due to our block, this flag will be true
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
    # Already in a continuation loop, allow stop to prevent infinite recursion
    # This is critical to avoid infinite typecheck->fix->typecheck loops
    exit 0
fi

# Change to project directory if available
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
    cd "$CLAUDE_PROJECT_DIR"
fi

# Run nuxt typecheck and capture output
TYPECHECK_OUTPUT=$(npm run typecheck 2>&1) || TYPECHECK_EXIT_CODE=$?
TYPECHECK_EXIT_CODE=${TYPECHECK_EXIT_CODE:-0}

if [ "$TYPECHECK_EXIT_CODE" -eq 0 ]; then
    # No type errors, allow Claude to stop
    # Optional: output JSON to show success message to user
    echo '{"systemMessage": "✅ `nuxt typecheck` passed"}'
    exit 0
else
    # Type errors found - block the stop and feed errors back to Claude
    # Exit code 2: stderr text is shown to Claude as feedback
    cat >&2 <<EOF
TypeScript type check failed. Please fix the following errors:

$TYPECHECK_OUTPUT

Review the errors above and make the necessary corrections to resolve all type issues.
EOF
    
    exit 2
fi