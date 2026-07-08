# Phase 3 — E2E Repair + CI Gates

> Part 3 of 3. E2E work (E1–E4) can run **in parallel with Phase 2 from wave B3 onward**; CI work (C1–C3) lands **last**, after thresholds stabilize.

## 1. Context

Current E2E state (verified):
- `tests/e2e/fixtures/api-mocks.ts` intercepts `**/api/auth/login`, `**/api/auth/refresh`, `**/api/auth/logout`, `**/api/chat/sessions` — **all dead routes**. Real endpoints: `/api/authentication/login`, `/api/authentication/refresh-token`, `/api/authentication/forgotten-password`, `/api/settings/config.json`, `/api/AIWebAPI/*`, `/api/user/get-selectable-users`, `/api/Log/log`. The mocks match nothing; specs relying on them either hit the real backend or hang.
- `tests/e2e/fixtures/auth.ts` does a **real login** (`#email`/`#password` fill + click, waits for `/chats`) with `.env.test` credentials — tension with route mocks.
- `playwright.config.ts`: 3 browser projects, no `webServer` block (expects app already running), baseURL `localhost:3000`, `.env.test` loaded.
- Duplication: flat `tests/e2e/auth.spec.ts` (inline selectors) overlaps `tests/e2e/auth/{login,logout,session}.spec.ts` (uses `actions/auth.actions.ts` + `selectors/`).
- CI: `ci.yml` runs lint+typecheck+`test:run`+build — **no coverage gate**. `e2e.yml` writes `.env.test` from secrets, targets deployed `TEST_BASE_URL` (real backend). `knip` + `jscpd` exist as scripts, not in CI.
- `nuxt.config.ts` has `ssr: false` → `npm run build && npm run preview` serves the SPA from `.output` — a valid, backend-free E2E target when routes are mocked.

Strategy decision (recommended, from design review): **split Playwright into two project families** —
1. `chromium-mocked` — fully route-mocked, hermetic, runs on every PR. Fast, deterministic, no secrets.
2. `real-backend` — real login vs deployed `TEST_BASE_URL`, smoke subset only, main-branch + nightly, secrets-gated. Keeps the "does it work against the actual C# API" signal without PR flakiness.

---

## 2. Step E1 — Fix the route-mock layer

File: `tests/e2e/fixtures/api-mocks.ts` (rewrite).

### E1.1 Endpoint corrections
| Old (dead) | New |
|---|---|
| `**/api/auth/login` | `**/api/authentication/login` |
| `**/api/auth/refresh` | `**/api/authentication/refresh-token` |
| `**/api/auth/logout` | (verify a logout endpoint exists in AuthService; if client-side only, delete the mock) |
| `**/api/chat/sessions` | `**/api/AIWebAPI/GetSessionHeadersByUserId` (+ friends) |
| — (missing) | `**/api/settings/config.json` — REQUIRED: config-init plugin blocks app boot semantics |
| — (missing) | `**/api/AIWebAPI/GetSessionById`, `question/text`, `welcomeText`, `GetUnreadMessages`, `Set_SessionMessagesRead`, … |
| — (missing) | `**/api/user/get-selectable-users` |
| — (missing) | `**/api/Log/log` → 200 sink |

Single source of truth discipline: derive the path list by reading `lib/api/services/*.ts` at implementation time; add a comment in api-mocks.ts pointing at the services as the authority. (Optional later improvement: share fixture payloads between MSW handlers and Playwright mocks via a common `tests/fixtures-data/` module — both layers import the same JSON builders. Do it if drift bites twice.)

### E1.2 Response envelope
All fulfilled bodies must use the backend envelope `{ data, success: null, warning: null, error: null }` — mirror `tests/msw/http.ts` helpers with a small local `fulfillOk(route, data)` / `fulfillError(route, status, code)` pair (Playwright can't import vitest-side helpers cleanly; keep the E2E copies tiny and colocated).

### E1.3 Public API of the fixture module
```ts
export async function mockAllApis(page: Page): Promise<void>   // installs full happy-path set
export async function mockLoginSuccess(page, user?)            // individual overrides kept
export async function mockLoginFailure(page, status = 401)
export async function mockRefreshFailure(page)
export async function mockNetworkError(page, urlPattern)
export async function mockTimeout(page, urlPattern)
export async function clearAllMocks(page)
```
Error-scenario helpers (`mockNetworkError`, `mockTimeout`, `mockAuthError`, `mockValidationError`, `mockNotFoundError`) already exist — retarget their URL patterns, keep their API.

### E1.4 Mocked-auth fixture
New fixture `mockedAuthenticatedPage`: `mockAllApis(page)` → goto `/login` → fill + submit against the *mocked* login → wait for `/chats`. Exercises the real login UI + storage code paths with zero backend. (Alternative of pre-seeding localStorage is faster but skips the login flow — use seeding only in specs where login isn't the subject: add `seedAuthLocalStorage(page)` helper using `page.addInitScript` writing `innochat-auth` before app boot.)

---

## 3. Step E2 — Playwright config: projects split + webServer

File: `playwright.config.ts`.

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  // ...existing retry/reporter settings...
  webServer: process.env.TEST_BASE_URL ? undefined : {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium-mocked',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3000' },
      grepInvert: /@real/,
    },
    {
      name: 'real-backend',
      use: { ...devices['Desktop Chrome'], baseURL: process.env.TEST_BASE_URL },
      grep: /@real/,
    },
    // firefox / webkit: move to nightly matrix (mocked), drop from PR path
    {
      name: 'firefox-mocked',
      use: { ...devices['Desktop Firefox'] },
      grepInvert: /@real/,
    },
    {
      name: 'webkit-mocked',
      use: { ...devices['Desktop Safari'] },
      grepInvert: /@real/,
    },
  ],
})
```
Conventions:
- Specs tag real-backend smoke tests in the title: `test('login with real backend @real', …)`. Everything untagged is mocked-hermetic.
- `NUXT_PUBLIC_API_BASE_URL=http://localhost:3000` for the preview server so all `/api/**` calls are same-origin and interceptable by `page.route`. Verify how `getApiBaseUrl()` reads runtime config in the built SPA (`window.__NUXT__.config.public.apiBaseUrl`) — may require `NUXT_PUBLIC_API_BASE_URL` at **build** time or a runtime `config.json`/env override; settle during implementation.
- Real-backend project keeps existing `fixtures/auth.ts` real-login fixtures + `.env.test` credentials.
- Build cost mitigation: in CI reuse the build artifact from the existing build job (upload `.output`, download in e2e job) instead of rebuilding.

## 4. Step E3 — Spec dedupe + retagging

1. **Delete** flat `tests/e2e/auth.spec.ts` after porting any unique assertions into `tests/e2e/auth/{login,logout,session}.spec.ts` (these already use `actions/` + `selectors/` — the better pattern). Diff the two first; expected uniques: none or 1–2 edge assertions.
2. Sweep all ~13 specs: replace direct backend expectations with `mockAllApis` + overrides; tag the small real-backend smoke set `@real` (recommend: login happy path, send one message, logout — 3 specs max).
3. Specs that only work with real data (diagnostics?) → `@real` or delete if redundant with mocked equivalents.

## 5. Step E4 — New mocked E2E scenarios (the browser-quirk layer)

Now-possible hermetic specs (each impossible or flaky against a real backend):
| Spec | Scenario |
|---|---|
| `token-expiry.spec.ts` | login (mocked) → next API call routed to 401 once → assert UI *doesn't* bounce to login (silent refresh) → then `mockRefreshFailure` → next 401 → assert redirect to `/login` |
| `public-mode.spec.ts` | mock `config.json` with `publicMode: 1` + agent → goto `/chats/public/new/<agentId>` → auto-login fired (route spy) → chat renders with public header; sessionStorage (not localStorage) holds tokens (`page.evaluate`) |
| `offline.spec.ts` | `context.setOffline(true)` mid-session → UI error state → `setOffline(false)` → recovery/refetch |
| `slow-network.spec.ts` | `mockTimeout` on sessions → loading skeleton visible → fulfill → content |
| `error-states.spec.ts` | 500 on sessions list → error UI + retry button works (route flips to success) |

These join Phase 2's integration tests as the outer safety net; keep them few and user-journey-shaped (E2E count stays lean — the pyramid's width lives in Vitest).

---

## 6. Step C1 — Coverage gate in CI

File: `.github/workflows/ci.yml`.
- Replace `npm run test:run` with `npm run test:coverage`. **Vitest's committed `coverage.thresholds` IS the gate** — the run exits non-zero on any drop below thresholds. No custom script needed for gating.
- Upload `coverage/` as artifact (job summary link).
- Ratchet mechanics (process, not tooling): every Phase 2 wave PR raises thresholds to `floor(actual − 2)` in `vitest.config.ts` with a dated comment. `coverage.thresholds.autoUpdate: true` may be used **locally** by wave authors to compute the new floor, but is never committed enabled.
- Per-glob thresholds so strong dirs don't mask weak ones (vitest supports glob keys):
```ts
thresholds: {
  global: { branches: X, functions: X, lines: X, statements: X },
  'lib/**': { lines: 95 },
  'app/stores/**': { lines: 95 },
  'app/composables/**': { lines: 90 },
  'app/plugins/**': { lines: 90 },
  'app/middleware/**': { lines: 90 },
  'app/components/**': { lines: 85 },
  'app/pages/**': { lines: 80 },
}
```
(Introduce globs at their target values only when the corresponding wave lands; before that, keep global-only.)
- Optional (skip unless PR-comment reporting is wanted): `scripts/coverage-ratchet.mjs` comparing PR coverage-summary.json vs main artifact.

## 7. Step C2 — E2E workflows split

File: `.github/workflows/e2e.yml` → two jobs:
```yaml
e2e-mocked:            # PR gate
  # no secrets; download .output artifact from build job (or build here, cached)
  # npx playwright test --project=chromium-mocked
  # webServer starts `npm run preview` automatically

e2e-real:              # push to develop + nightly cron
  if: github.event_name == 'schedule' || github.ref == 'refs/heads/develop'
  # existing secrets → .env.test flow, TEST_BASE_URL target
  # npx playwright test --project=real-backend
```
- Firefox/webkit mocked projects → nightly matrix only (PR wall-clock budget ~10 min).
- Real-backend flakiness stays quarantined off the PR gate by design; nightly failures page a human, don't block merges.

## 8. Step C3 — Static-quality gates promotion

- Add `npm run knip` and `npm run duplication` (jscpd) to ci.yml as **non-blocking** (`continue-on-error: true`) immediately.
- Promote to blocking after Phase 2 wave B6 lands (backfill churn otherwise fights dead-code detection).

---

## 9. Execution order & dependencies

```
Phase 1 (foundation) ──► Phase 2 B1 ──► B2 ──► B3 ──► B4 ──► B5 ──► B6
                                        │
                                        ├──► E1 fix mocks ──► E2 config split ──► E3 dedupe ──► E4 new specs
                                        │
                                        └────────────────────────────── (after B6 + E4) ──► C1 coverage gate ──► C2 e2e split ──► C3 promote knip/jscpd
```
- E1–E4: one or two PRs, parallel to B3+.
- C1 waits for final B6 ratchet (avoid re-touching thresholds twice).
- C2 waits for E2/E3 (projects must exist).

## 10. Verification per step
| Step | Gate |
|---|---|
| E1 | `npx playwright test --project=chromium-mocked` locally against `npm run preview`; zero unrouted `/api` calls (assert via `page.on('request')` logger in a smoke spec) |
| E2 | fresh clone + `npx playwright test` works with NO env vars, NO backend, NO secrets |
| E3 | spec count reconciled; no `@real`-untagged spec touches `TEST_BASE_URL` |
| E4 | new specs pass 3 consecutive runs (flake check: `--repeat-each=3`) |
| C1 | intentionally lower a threshold locally → CI-equivalent run fails; restore |
| C2 | PR run shows e2e-mocked only; nightly dry-run (workflow_dispatch) runs real-backend |
| C3 | knip/jscpd steps appear green-or-warning in PR checks |

## 11. Risks
- **Preview-server API base URL**: built SPA may bake `apiBaseUrl` at build time — if `page.route` doesn't see `/api` calls (absolute URLs to another origin), route pattern must match that origin, or build with `NUXT_PUBLIC_API_BASE_URL=http://localhost:3000`. Resolve at E2 with a 10-minute probe spec.
- **webServer build time in CI** (~minutes): reuse build-job artifact; `reuseExistingServer` locally.
- **Route-mock drift recurrence**: the `page.on('request')` unrouted-call logger in a permanent smoke spec turns silent drift into loud failure — cheap insurance, do it.
- **Nightly real-backend rot**: assign ownership — nightly red for >3 days gets an issue auto-filed (manual process note, not tooling, for now).
