#!/bin/bash

# Claude Code Stop Hook: Skill Update Reminder
# Detects if there are uncommitted changes and vonno-* skills exist,
# then asks Claude to offer the developer a skill update evaluation.
# Does NOT spawn external processes — Claude handles the subagent work.
#
# Exit codes:
#   0 - Allows stop (no skills or no changes)
#   2 - Blocks stop (forces AskUserQuestion interaction)

INPUT=$(cat)

STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
    exit 0
fi

if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
    cd "$CLAUDE_PROJECT_DIR"
fi

SKILLS_DIR="$CLAUDE_PROJECT_DIR/.claude/skills"

# Collect vonno-* skill names
SKILL_NAMES=()
for dir in "$SKILLS_DIR"/vonno-*/; do
    [ -d "$dir" ] && SKILL_NAMES+=("$(basename "$dir")")
done

if [ ${#SKILL_NAMES[@]} -eq 0 ]; then
    exit 0
fi

# Check for uncommitted changes
DIFF_STAT=$(git diff --stat HEAD 2>/dev/null)
if [ -z "$DIFF_STAT" ]; then
    exit 0
fi

# Build skill options list for AskUserQuestion
SKILL_OPTIONS=""
for name in "${SKILL_NAMES[@]}"; do
    SKILL_OPTIONS="${SKILL_OPTIONS}  - ${name}
"
done

cat >&2 <<EOF
SKILL UPDATE CHECK: There are uncommitted changes in this session.

You MUST use AskUserQuestion with a MULTI-SELECT question (multiSelect: true) listing each skill below as a selectable option. Do NOT include a "Skip" option — if the developer selects none (uses "Other" or submits empty), that means skip. The question header should be "Skill update".

Skills to list as options:
${SKILL_OPTIONS}
For each selected skill, spawn 1 haiku subagent (Agent tool) that reads the skill content (via Skill tool), reviews git diff HEAD, and reports whether the skill needs updating and why. Present the findings to the developer. If the developer selects no skills, you may stop.

Changed files:
${DIFF_STAT}
EOF

exit 2
