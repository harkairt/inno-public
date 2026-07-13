# E2E Testing with Playwright

This directory contains end-to-end tests for the Vonno application using Playwright.

## Setup

### 1. Install Dependencies

```bash
npm install
npx playwright install
```

### 2. Configure Test Environment

`.env.test` is **only** needed for the `real-backend` project (`npm run test:e2e:real`).
The mocked projects route-mock every `/api` call and need no configuration.

Copy the example environment file and fill in your test credentials:

```bash
cp .env.test.example .env.test
```

Edit `.env.test` with your actual test backend URL and credentials:

```env
TEST_BASE_URL=http://localhost:3000
TEST_USER_EMAIL=testuser@vonno.com
TEST_USER_PASSWORD=Test123!
TEST_ADMIN_EMAIL=admin@vonno.com
TEST_ADMIN_PASSWORD=Admin123!
```

**Important:** The `.env.test` file is gitignored and should never be committed. Test user accounts should already exist in your test database/backend.

`TEST_BASE_URL` may stay set permanently — mode follows which `--project` you select,
not the presence of this variable. It only registers and targets the `real-backend`
project; the mocked projects always build + preview the SPA locally on
`http://localhost:3000`.

## Running Tests

### Run All Tests (Headless)

```bash
npm run test:e2e
```

### Interactive UI Mode

Best for development and debugging:

```bash
npm run test:e2e:ui
```

### Debug Mode

Run tests with step-through debugging:

```bash
npm run test:e2e:debug
```

### Headed Mode

Run tests in a visible browser:

```bash
npm run test:e2e:headed
```

### Run Only Chrome Tests

```bash
npm run test:e2e:chrome
```

### Run Real-Backend Smoke Tests

Runs the `@real`-tagged subset against the deployment at `TEST_BASE_URL` (no local
server). Requires `TEST_BASE_URL` set in `.env.test`:

```bash
npm run test:e2e:real
```

### View Test Report

After running tests, view the HTML report:

```bash
npm run test:e2e:report
```

### Generate Test Code

Use Playwright's code generator to record test interactions:

```bash
npm run test:e2e:codegen
```

## Projects

Defined in `playwright.config.ts`:

| Project | Runs | Backend |
| --- | --- | --- |
| `chromium-mocked` (PR gate) | every spec not tagged `@real` | none — all `/api/**` calls are route-mocked |
| `mobile-chromium-mocked` | specs tagged `@mobile`, under the Pixel 7 device descriptor | none — same mocks |
| `firefox-mocked` / `webkit-mocked` | cross-browser variants of the mocked set | none |
| `real-backend` | the `@real`-tagged smoke subset | deployment at `TEST_BASE_URL` |

### Mobile project

Add `@mobile` to a test title to include it in `mobile-chromium-mocked` — the
test then also runs with true device emulation (viewport, DPR, touch, mobile
user agent) on top of its desktop runs. Existing tests that switch layout via
`page.setViewportSize(...)` keep working unchanged in every project; the device
project complements them rather than replacing them.

```bash
npx playwright test --project=mobile-chromium-mocked
```

Only tag tests that are meaningful and pass under a mobile viewport (e.g. no
reliance on the desktop rail or hover-only affordances).

## Test Structure

```
tests/e2e/
├── fixtures/          # Reusable test fixtures
│   ├── auth.ts       # Authentication fixtures (incl. mockedAuthenticatedPage)
│   ├── api-mocks.ts  # Route mocks — real backend paths from lib/api/services/*.ts
│   └── index.ts      # Export all fixtures
├── mocks/data/        # Mock DTOs (schema-valid users/sessions/messages)
├── actions/           # Reusable user workflows
├── selectors/         # Centralized selector registry
├── auth/              # Login/logout/session specs
├── chats/             # Discovery, navigation, messaging, session mgmt, new chat
├── users/             # Users page specs
└── *.spec.ts          # Public mode, error states, slow network, token expiry
```

## Writing Tests

### Using Authentication Fixtures

For tests that require an authenticated user, use the `authenticatedPage` fixture:

```typescript
import { test, expect } from './fixtures'

test('my authenticated test', async ({ authenticatedPage }) => {
  // authenticatedPage is already logged in as a regular user
  await authenticatedPage.goto('/chats')
  // ... your test code
})
```

For admin-specific tests, use the `adminPage` fixture:

```typescript
test('admin feature test', async ({ adminPage }) => {
  // adminPage is already logged in as an admin user
  await adminPage.goto('/users')
  // ... your test code
})
```

### Unauthenticated Tests

For testing login flows or public pages, use the standard `page` fixture:

```typescript
test('login test', async ({ page }) => {
  await page.goto('/login')
  // ... your test code
})
```

## Test Coverage

### Current Test Suites

1. **Valid Login Flow**
   - Login with valid credentials
   - Admin login

2. **Login Validation**
   - Empty email validation
   - Empty password validation
   - Invalid credentials error
   - Malformed email validation

3. **Session Persistence**
   - Session after page refresh
   - Session across navigation

4. **Logout Flow**
   - Logout and redirect
   - Protected route access after logout

5. **Protected Routes**
   - Unauthenticated redirects
   - Authenticated access control

6. **Login UI Elements**
   - Form element visibility
   - Loading states

7. **Remember Me**
   - Checkbox functionality

8. **Chat Journeys** (`chats/`)
   - Discovery page, navigation, messaging, session rename
   - Session delete via `SessionItemMenu` (confirm removes the session, cancel keeps it; mocked `DeleteSessionById`)
   - New chat with a user: users page → `/chats/new/[userId]` → first message creates the session → mocked AI reply renders (`chats/new-chat.spec.ts`)

9. **Public / iframe Mode** (`public-mode.spec.ts`)
   - Auto-login boot, sessionStorage tokens, public header
   - Messaging round-trip: send on `/chats/public/new/[agentId]` → navigates to the created session → mocked reply renders

10. **Accessibility smoke** (`a11y.spec.ts`)
    - axe-core scans (via `@axe-core/playwright`) of six key UI states: `/login`
      (unauthenticated), the authenticated chat list, an active conversation with
      messages, the session-item menu with the delete-confirm dialog open, public /
      iframe mode, and the chat list under a mobile viewport (`@mobile`).
    - Scoped to the `wcag2a` + `wcag2aa` rule sets so the scope stays stable across
      axe releases. UI is scanned in English (Playwright's default en-US locale).

#### a11y ratchet philosophy

The a11y spec is **not** a flat `toEqual([])` gate — the app has known,
pre-existing violations that a hard-zero assertion would fail on. Instead each
state carries a committed **baseline** constant (the violation count at the time
the scan was added), and the test asserts the current count is `<=` that baseline:

- A **new** violation pushes the count above the baseline → the test fails, so a
  regression is caught the moment it lands.
- **Fixing** violations drops the count below the baseline (still green). When you
  fix some, **lower the baseline constant** to the new count in the same change so
  the improvement is locked in and can never silently regress.
- **Baselines only ever go DOWN, never up.** Raising a baseline to make a failing
  scan pass is forbidden — fix the violation instead.
- A state that reaches **zero** violations switches to `toEqual([])` (a hard zero)
  so it can never regress even by one.

Baseline constants live at the top of `a11y.spec.ts`. Each run prints the current
count per state (`[a11y] <state>: <n> violation(s) (baseline <b>)`) to make
re-ratcheting after a fix straightforward.

### Deliberate gap: SignalR receive at the E2E layer

Real-time `ReceiveMessage` pushes are **not** covered by Playwright specs, by
decision (2026-07): mocking SignalR at the browser boundary would require
faking the negotiate handshake *and* speaking the hub's WebSocket JSON protocol
(`0x1e`-terminated handshake/invocation frames, keepalive pings) via
`page.routeWebSocket` — a heavy, flake-prone protocol shim for one assertion.
The flow is covered at the integration layer instead:
`tests/integration/receive-message.test.ts` drives a fake SignalR singleton
through the real Vue Query cache-update path. Revisit only if a regression
slips past that layer.

## Debugging

### Visual Debugging Tools

- **UI Mode**: `npm run test:e2e:ui` - Interactive test runner with timeline and DOM snapshots
- **Debug Mode**: `npm run test:e2e:debug` - Step through tests with browser DevTools
- **Headed Mode**: `npm run test:e2e:headed` - Watch tests run in real browser

### Trace Viewer

When tests fail, Playwright automatically captures traces. View them with:

```bash
npx playwright show-trace test-results/.../trace.zip
```

### Screenshots and Videos

Failed tests automatically capture:

- Screenshots (in `test-results/`)
- Videos (in `test-results/`)
- Traces (in `test-results/`)

## Troubleshooting

### Tests Failing on Login

**Issue:** Login tests fail with "Invalid credentials" or timeout

**Solutions:**

1. Verify `.env.test` credentials match your test backend
2. Ensure test backend is running at `TEST_BASE_URL`
3. Check that test user accounts exist in the test database
4. Verify test backend authentication endpoints are working

### Timeout Errors

**Issue:** Tests timeout waiting for elements or navigation

**Solutions:**

1. Increase timeout in `playwright.config.ts`:
   ```typescript
   use: {
     actionTimeout: 10000, // 10 seconds
     navigationTimeout: 30000, // 30 seconds
   }
   ```
2. Check network connectivity to test backend
3. Verify test backend is responding quickly

### Connection Refused

**Issue:** `ECONNREFUSED` errors when running tests

**Solutions:**

1. Ensure test backend is running at the URL specified in `TEST_BASE_URL`
2. Check that the backend is accessible from your machine
3. Verify no firewall blocking the connection

### Element Not Found

**Issue:** Tests fail because elements are not found

**Solutions:**

1. Run in UI mode to inspect the page: `npm run test:e2e:ui`
2. Use Playwright Inspector: `npm run test:e2e:debug`
3. Check if selectors match the actual DOM structure
4. Verify translations are loaded (i18n may affect button text)

### Tests Pass Locally but Fail in CI

**Solutions:**

1. Ensure all required environment variables are set in CI
2. Check that test backend is accessible from CI environment
3. Verify browser installation in CI (handled by workflow)
4. Review CI logs for specific error messages

## Best Practices

### Do's

✅ Use semantic selectors (role, label, text) over CSS selectors
✅ Use fixtures for common setup (authentication)
✅ Test user behavior, not implementation details
✅ Keep tests independent and isolated
✅ Use meaningful test descriptions
✅ Clean up after tests (logout, reset state)

### Don'ts

❌ Don't hardcode delays (`page.waitForTimeout()`)
❌ Don't rely on test execution order
❌ Don't test multiple unrelated things in one test
❌ Don't use brittle selectors (CSS classes that may change)
❌ Don't share state between tests

## CI/CD Integration

Tests run automatically on:

- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop`

GitHub Actions workflow location: `.github/workflows/e2e.yml`

### Required GitHub Secrets

Configure these secrets in your repository settings:

- `TEST_BASE_URL` - URL of test backend
- `TEST_USER_EMAIL` - Test user email
- `TEST_USER_PASSWORD` - Test user password
- `TEST_ADMIN_EMAIL` - Test admin email
- `TEST_ADMIN_PASSWORD` - Test admin password

## Extending Tests

### Adding New Test Files

1. Create new spec file in `tests/e2e/`:

   ```typescript
   import { test, expect } from './fixtures'

   test.describe('My Feature', () => {
     test('should do something', async ({ authenticatedPage }) => {
       // your test
     })
   })
   ```

2. Run specific file:
   ```bash
   npx playwright test tests/e2e/my-feature.spec.ts
   ```

### Creating New Fixtures

Add fixtures to `tests/e2e/fixtures/`:

```typescript
// tests/e2e/fixtures/chat.ts
import { test as base } from '@playwright/test'

export const test = base.extend({
  chatPage: async ({ authenticatedPage }, use) => {
    await authenticatedPage.goto('/chats/new')
    // setup code
    await use(authenticatedPage)
    // teardown code
  },
})
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Nuxt Testing Guide](https://nuxt.com/docs/getting-started/testing)
- [@nuxt/test-utils](https://github.com/nuxt/test-utils)

## Support

For questions or issues:

1. Check this README
2. Review Playwright documentation
3. Check existing test examples in this directory
4. Ask the team
