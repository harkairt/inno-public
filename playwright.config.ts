import { defineConfig, devices } from '@playwright/test'
import { configDotenv } from 'dotenv'

// Load test environment variables from .env.test.
// This feeds the real-backend project: credentials (TEST_USER_*/TEST_ADMIN_*) and
// TEST_BASE_URL. The mocked projects do NOT depend on it — they always target the
// locally-built preview server on http://localhost:3000 and route-mock every /api call.
configDotenv({ path: '.env.test', override: true })

// When TEST_BASE_URL is set we are running the @real smoke subset against a deployed
// backend, so no local server is built. Otherwise we build + preview the SPA locally
// and serve the hermetic, fully route-mocked projects from it.
const isRealBackend = !!process.env.TEST_BASE_URL

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [['html'], ['list']],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Build + preview the SPA locally for the mocked projects. Skipped when
  // TEST_BASE_URL targets a remote deployment (real-backend project).
  // NUXT_PUBLIC_API_BASE_URL is forced empty so the built SPA issues same-origin,
  // relative `/api/**` calls (see lib/api/client.ts getApiBaseUrl) — a hard
  // requirement for Playwright's page.route('**/api/**') to intercept them.
  webServer: isRealBackend
    ? undefined
    : {
        command: 'npm run build && npm run preview',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          NUXT_PUBLIC_API_BASE_URL: '',
        },
      },

  projects: [
    {
      name: 'chromium-mocked',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3000' },
      grepInvert: /@real/,
    },
    {
      name: 'firefox-mocked',
      use: { ...devices['Desktop Firefox'], baseURL: 'http://localhost:3000' },
      grepInvert: /@real/,
    },
    {
      name: 'webkit-mocked',
      use: { ...devices['Desktop Safari'], baseURL: 'http://localhost:3000' },
      grepInvert: /@real/,
    },
    {
      name: 'real-backend',
      use: { ...devices['Desktop Chrome'], baseURL: process.env.TEST_BASE_URL },
      grep: /@real/,
    },
  ],
})
