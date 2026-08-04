<!--
Sync Impact Report
==================
Version change: (template, unversioned) → 1.0.0
Bump rationale: MAJOR — first concrete ratification; every placeholder token
  replaced with project-specific governance. Establishes the baseline.

Principles defined (all new):
  - I. Layered Architecture
  - II. Typed Result Error Handling
  - III. Network-Boundary Testing (NON-NEGOTIABLE)
  - IV. Bilingual by Default
  - V. Dual-Mode & Cross-Device Support

Sections defined:
  - Security & Fragile-Area Constraints (new)
  - Development Workflow & Quality Gates (new)
  - Governance (new)

Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check gate rewritten
     to the five concrete principle gates
  ✅ .specify/templates/spec-template.md — reviewed; tech-agnostic by design,
     no change required
  ✅ .specify/templates/tasks-template.md — reviewed; principle-driven task
     types (i18n pairing, MSW tests, typecheck gate) surface via plan.md, no
     structural change required

Deferred / follow-up TODOs: none
-->

# InnoChat Constitution

## Core Principles

### I. Layered Architecture

The dependency graph flows in one direction and MUST NOT be short-circuited:
`Pages → Data-Aggregation Composables → Query/Mutation Composables → Services → apiClient`.

- Pages and components MUST consume composables only. A page MUST NEVER import a
  service (`lib/api/services/`) or `apiClient` directly.
- All server state MUST be owned by TanStack Vue Query composables
  (`useChatQueries`, `useChatMutations`); app-wide UI state MUST live in Pinia
  stores (`auth`, `chat`, `config`).
- HTTP calls MUST live in a service under `lib/api/services/`; real-time delivery
  MUST go through `lib/signalr/`. New code MUST land in the location prescribed by
  the "Where to Put New Code" table in `vonno-overview`.

**Rationale**: The layering is what makes server state, real-time updates, and UI
independently testable and independently changeable. A page that reaches past a
composable couples rendering to transport and defeats the Vue Query cache.

### II. Typed Result Error Handling

Errors are values, not exceptions, and untrusted data is validated at the boundary.

- Services MUST return `Result<T, AppError>` (neverthrow) and MUST NOT throw. The
  `AppError` hierarchy in `lib/errors/types.ts` is the only error currency crossing
  the service boundary.
- Data entering the system (API responses, config, user input) MUST be validated
  with a Zod schema from `lib/validation/` or `types/api/schemas.ts` before it is
  trusted by a typed consumer.
- Failures MUST surface — no empty `catch`, no silent fallback that hides a real
  error from the user or the caller. TypeScript runs in strict mode; `npm run
  typecheck` MUST pass before any commit.

**Rationale**: Explicit Result types force every caller to handle failure at compile
time; Zod guarantees the runtime shape matches the type. Silent fallbacks are how
this codebase's known bugs (e.g. hardcoded `agentId` fallback) reached production.

### III. Network-Boundary Testing (NON-NEGOTIABLE)

Integration and component tests exercise real code through a mocked network, never
through mocked internals.

- Tests MUST mock at the HTTP boundary with MSW 2 (`tests/msw/handlers/`). Tests
  MUST NOT mock Pinia stores, services, or `apiClient`.
- Components and pages MUST be rendered via `renderWithProviders`
  (`tests/utils/render.ts`); an unhandled HTTP request MUST fail the test.
- Coverage thresholds in `vitest.config.ts` are ratcheted and MUST only move
  upward — a change MAY raise them but MUST NEVER lower them.
- Tests pin CURRENT behavior, including documented bugs. Fixing such a bug MUST
  include updating the test that encoded the old behavior in the same change.

**Rationale**: Mocking internals tests the mock, not the app. Boundary tests prove
the real store/composable/service wiring works end-to-end, which is the only thing
that survives a refactor.

### IV. Bilingual by Default

Every user-facing string is a translation key present in both locales.

- User-facing text MUST be an i18n key, never a hardcoded literal in a component.
- Every key added to `i18n/locales/en.json` MUST also be added to
  `i18n/locales/hu.json`, and vice versa. The default language is Hungarian (`hu`).

**Rationale**: Hungarian is the default, not the afterthought. A key present in one
locale but not the other renders a raw key or an English fallback to real users.

### V. Dual-Mode & Cross-Device Support

The app serves two operating modes and two input paradigms; a feature is not done
until it accounts for all four.

- Every feature MUST behave correctly in both **Authenticated** mode (`/login`,
  JWT, `localStorage`, SignalR connected) and **Public/iframe** mode
  (`/chats/public/new/[agentId]`, auto-login, `sessionStorage`, REST-only), or MUST
  explicitly guard itself to one mode.
- Every interactive feature MUST support both desktop (keyboard, pointer) and mobile
  (touchscreen) as first-class targets.
- Routing and auth decisions MUST be made in `app/middleware/auth.global.ts` — mode
  detection MUST NOT be scattered across pages.

**Rationale**: Public mode is embedded in third-party iframes with a different
storage and transport model; a change that assumes authenticated context silently
breaks embedders. The product targets web across form factors, not desktop-first.

## Security & Fragile-Area Constraints

- Rendered/`v-html` content MUST pass through `sanitizeHTML`
  (`app/utils/sanitize.ts`, DOMPurify). Adding a new content-rendering surface
  requires auditing `ALLOWED_TAGS` / `ALLOWED_ATTR`.
- Client-side password hashing MUST NOT be extended to new call sites — SHA-512 is
  not a KDF and the hash effectively is the password.
- Fragile areas documented in `vonno-concerns` (token-refresh interceptor,
  `useSendMessage` optimistic cache, SignalR listener registration, primary-session
  detection) MUST be read and their stated pre-modification checks satisfied before
  they are changed.

## Development Workflow & Quality Gates

- Before any commit: `npm run typecheck`, `npm run lint`, and `npm run test:run`
  MUST be green.
- Changes MUST be surgical: touch only what the task requires, match surrounding
  style, and do not refactor or reformat adjacent code that is not broken.
- Comments MUST state a non-obvious constraint, invariant, or "why" — never restate
  what the code does.
- Prefer reusing existing composables, services, and utilities over introducing new
  abstractions for single-use code.

## Governance

This constitution supersedes ad-hoc convention when the two conflict. It governs how
features are specified, planned, and implemented in this repository.

- **Amendments** MUST be made through the `/speckit-constitution` workflow, which
  updates this file and propagates changes to dependent templates
  (`plan-template.md`, `spec-template.md`, `tasks-template.md`).
- **Versioning** follows semantic versioning: MAJOR for backward-incompatible
  principle removals or redefinitions, MINOR for a new principle or materially
  expanded guidance, PATCH for clarifications and non-semantic refinements.
- **Compliance**: every plan's Constitution Check gate MUST be evaluated against
  these principles before Phase 0 and re-checked after design. Deviations MUST be
  recorded in the plan's Complexity Tracking table with a justification and the
  simpler alternative that was rejected. Unjustifiable complexity MUST be removed,
  not documented.
- Runtime development guidance lives in `CLAUDE.md` and the `.claude/skills/`
  vonno-* skills; this constitution defines the non-negotiable rules those docs
  elaborate.

**Version**: 1.0.0 | **Ratified**: 2026-07-23 | **Last Amended**: 2026-07-23
