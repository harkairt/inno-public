# E2E Testing with Playwright

This directory contains end-to-end tests for the Vonno application using Playwright.

## Setup

### 1. Install Dependencies

```bash
npm install
npx playwright install
```

### 2. Configure Test Environment

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

## Test Structure

```
tests/e2e/
├── fixtures/          # Reusable test fixtures
│   ├── auth.ts       # Authentication helpers
│   └── index.ts      # Export all fixtures
└── auth.spec.ts      # Authentication flow tests
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
