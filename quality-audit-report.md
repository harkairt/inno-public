# Quality Audit Report

**Project**: vonno (InnoChat) — TypeScript + Nuxt 4 + Vue 3 + TanStack Query + Pinia
**Date**: 2026-05-17
**quality-toolkit**: v0.1.1

## Progress Since Last Audit

**Last audit**: 2026-05-16
**Score change**: 59/90 → 60/90 (+1)

| Dimension             | Previous | Current | Change |
|-----------------------|----------|---------|--------|
| Linting               | 9/10     | 9/10    | —      |
| Formatting            | 8/10     | 9/10    | +1     |
| Type checking         | 8/10     | 8/10    | —      |
| Complexity limits     | 8/10     | 8/10    | —      |
| Duplication detection | 7/10     | 7/10    | —      |
| Test coverage gate    | 6/10     | 6/10    | —      |
| Pre-commit hooks      | 6/10     | 6/10    | —      |
| CI quality gates      | 5/10     | 5/10    | —      |
| Security scanning     | 2/10     | 2/10    | —      |

### Quality Gate Maturity: 60/90 → 6.7/10 (Solid)

| Dimension             | Score | Status | Details                                                              |
|-----------------------|-------|--------|----------------------------------------------------------------------|
| Linting               | 9/10  | ✅     | ESLint type-aware + sonarjs + tanstack-query + regexp. 0 issues      |
| Formatting            | 9/10  | ✅     | Prettier + lint-staged + format:check. 0 unformatted files           |
| Type checking         | 8/10  | ✅     | strict: true, no-explicit-any error, enforced in CI. 0 TS errors    |
| Complexity limits     | 8/10  | ✅     | cognitive-complexity 15, max-depth 4, max-params 4, max-lines 80    |
| Duplication detection | 7/10  | ⚠️     | jscpd configured (3% threshold). Actual: 1.67% (19 clones)          |
| Test coverage gate    | 6/10  | ⚠️     | Ratcheted thresholds (branches 76%, lines 41%). Not enforced in CI   |
| Pre-commit hooks      | 6/10  | ⚠️     | Husky + lint-staged: prettier --write + eslint --fix on staged files |
| CI quality gates      | 5/10  | ⚠️     | CI: lint + typecheck + tests + build. Missing: format, coverage, security |
| Security scanning     | 2/10  | ❌     | npm audit local only. No secret scanning. No dependency audit in CI  |

## Current Issues Snapshot

- **ESLint**: 0 errors, 0 warnings
- **Prettier**: 0 unformatted files (was 49 last audit)
- **TypeScript**: 0 errors
- **Tests**: 383 passing, 0 failing (fixed logError test this session)
- **Duplication**: 1.67% (19 clones) — well under 3% threshold
- **Coverage**: Ratcheted at branches 76%, fns 52%, lines 41%, stmts 41%
- **Knip**: 13 unused files, 8 unused deps, 4 unused devDeps, 125 unused exports, 41 unused exported types, 4 unused enum members, 1 duplicate export, 4 unresolved imports

## Test Pyramid

```
        /\
       /  \        E2E: 11 specs (Playwright, 3 browsers)
      /    \
     /------\
    /        \     Integration: 0 — gap
   /----------\
  /            \   Unit: 30 files, ~382 tests (Vitest + Testing Library + MSW)
 /--------------\
/                \ Static: ESLint (type-aware + sonarjs + tanstack-query + regexp) + TypeScript strict + Knip
------------------
```

| Layer       | Tool                       | Count     | Notes                              |
|-------------|----------------------------|-----------|------------------------------------|
| Static      | ESLint + TypeScript + Knip | —         | Type-aware, sonarjs, query, regexp |
| Unit        | Vitest + MSW               | ~382      | Stores, composables, lib, utils    |
| Integration | —                          | 0         | Gap between unit and E2E           |
| E2E         | Playwright                 | 11 specs  | Auth, diagnostics, 3 browser prjs  |

## What Changed This Session

1. **Formatting**: All files now formatted (was 49 unformatted)
2. **Failing test**: Fixed logError test (prefix `[ErrorUtils]` + extra fields)

## Suggestions for Next Session

1. Add `format:check` to CI workflow
2. Add `test:coverage` to CI workflow (enforce ratcheted thresholds)
3. Add secret scanning (gitleaks) to CI
4. Add `npm audit` to CI
5. Tighten duplication threshold (3% → 2%, actual is 1.67%)
6. Add pre-commit typecheck or at least format check
7. Tune Knip config for Nuxt auto-imports to reduce false positives
8. Enable GitHub push protection (Settings → Code security)
