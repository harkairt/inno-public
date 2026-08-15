# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

### Agentic code exploration

- Prefer LSP over Grep/Read for code navigation — it's faster, precise, and avoids reading entire files. goToDefinition, findReferences, hover, documentSymbol, workspaceSymbol, goToImplementation, prepareCallHierarchy, incomingCalls, outgoingCalls
- Fallback to Grep when LSP isn't available or for text/pattern searches (comments, strings, config).
- Refer to `.claude/skills/` for architecture, implementation patterns, and testing guidance (`vonno-overview`, `vonno-implementation`, `vonno-testing`).

---

## Commands

```bash
npm run dev           # Start dev server (http://localhost:3000, proxies to :8082)
npm run build         # Production build
npm run typecheck     # nuxi typecheck (run before committing)
npm run lint          # ESLint
npm run lint:fix      # ESLint with auto-fix
npm run test          # Vitest (watch mode)
npm run test:run      # Vitest (single run)
npm run test:coverage # Vitest with coverage (ratcheted thresholds in vitest.config.ts)
npm run test:e2e      # Playwright E2E
npm run test:mutation # Stryker mutation testing (advisory; see stryker.config.json)
```

Run a single test file: `npx vitest run tests/path/to/file.test.ts`

---

## Architecture

**InnoChat** is a Nuxt 4 SPA (`ssr: false`) — Vue 3 frontend client to a C# backend API.

It targets web, and needs first-class support for both desktop mode (keyboard, pointer) and mobile (touchscreen)

### Layer order (top → bottom)

```
Pages
  └─ Data Aggregation Composables  (combine queries + UI logic, e.g. useChatListData)
       └─ Query/Mutation Composables  (useChatQueries, useChatMutations — TanStack Vue Query)
            └─ Services  (lib/api/services/ — return Result<T, AppError>)
                 └─ apiClient  (Axios, lib/api/client.ts)
Pinia Stores  ↔  Composables + Pages  (auth, chat, config)
SignalR  →  Vue Query cache updates  (lib/signalr/)
```

Pages consume composables only — never services directly.

### Two operating modes

| Mode | Route | Auth | Storage |
|---|---|---|---|
| Authenticated | `/login` → full app | User JWT | `localStorage` |
| Public/iframe | `/chats/public/new/[agentId]` | Auto-login from config.json | `sessionStorage` |

Mode is determined at startup by `config.json` (`publicAgentId` present → public mode). Enforced by `app/middleware/auth.global.ts`.

### Path aliases

- `@` → repo root (use for `lib/`, `types/`)
- `~` → `app/` directory (use for components, stores, composables)

### Key files

| File | Role |
|---|---|
| `app/middleware/auth.global.ts` | All routing/auth decisions |
| `app/plugins/api-interceptors.client.ts` | Token injection, 401 handling |
| `app/plugins/config-init.client.ts` | Loads `InnoChatConfig` at startup |
| `nuxt.config.ts` | Proxy rules, i18n, modules |

### Error handling & validation

- Services return `Result<T, AppError>` (neverthrow) — never throw
- Zod schemas in `lib/validation/` and `types/api/schemas.ts`
- `AppError` hierarchy in `lib/errors/types.ts`

### i18n

Default language is Hungarian (`hu`). Always add keys to both `i18n/locales/en.json` and `i18n/locales/hu.json`.

### Testing

- Unit/component tests: `tests/` with Vitest + Testing Library + MSW 2
- E2E: `tests/e2e/` with Playwright
- MSW 2 is wired into `tests/setup.ts` (`server.listen({ onUnhandledRequest: 'error' })`) — unhandled HTTP fails the test. Domain handlers in `tests/msw/handlers/` match real backend endpoints (`/api/authentication/*`, `/api/AIWebAPI/*`, `/api/settings/config.json`, ...). New tests mock at the network boundary with MSW; never mock Pinia stores, services, or `apiClient` in integration tests.
- State reset: `tests/utils/resetAllState.ts` runs in a global `beforeEach` in `tests/setup.ts` (fresh Pinia + reset module singletons per test).
- Render components/pages via `renderWithProviders` from `tests/utils/render.ts`.
- Coverage: thresholds are ratcheted in `vitest.config.ts` (source of truth) and raised per backfill wave. 80% is the goal, not an enforced flat gate.

---

## Agent skills

### Issue tracker

Issues are tracked as local markdown files in `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout. See `docs/agents/domain.md`.
