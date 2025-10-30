---
name: nuxt-typecheck
description: This Nuxt skill ensures that the codebase is syntactically correct and adheres to lint rules
---

# nuxt-typecheck

## Instructions
You need to run various commands and decide based on their output.
Whenever a command returns a result that means something has to be fixed then use @agent-Plan to work out a plan for fixing them.

1. **Initial Type Check**: Run `npx nuxt typecheck` command to verify TypeScript types:
   - If there are type errors, immediately use @agent-Plan to create a comprehensive fix plan
   - Wait for the fix plan to be implemented before proceeding

2. **Lint Check**: Run `bun run lint` command to verify code style and linting rules:
   - If there are lint errors, immediately use @agent-Plan to create a comprehensive fix plan
   - Wait for the fix plan to be implemented before proceeding

3. **Development Server Check**: Run `bun run dev` command and analyze the output carefully:
   - If there are syntax errors, compilation errors, or startup failures, immediately use @agent-Plan to create a comprehensive fix plan
   - Wait for the fix plan to be implemented before proceeding