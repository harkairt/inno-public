import { defineConfig, devices } from '@playwright/test'
import { configDotenv } from 'dotenv'

// Load test environment variables from .env.test.
// This feeds the real-backend project: credentials (TEST_USER_*/TEST_ADMIN_*) and
// TEST_BASE_URL. The mocked projects do NOT depend on it — they always target the
// locally-built preview server on http://localhost:3000 and route-mock every /api call.
// TEST_BASE_URL may stay permanently in .env.test; it only affects the real-backend project.
configDotenv({ path: '.env.test', override: true })

// Mode follows which --project you select on the CLI, NOT the presence of TEST_BASE_URL:
//   - Select only real-backend  → skip the local webServer (target the deployment).
//   - Select any mocked project, or select nothing → build + preview the SPA locally.
// The real-backend project only exists when TEST_BASE_URL is set, so a bare
// `playwright test` without it cleanly runs the mocked projects only, and
// `--project=real-backend` without the URL fails fast with "project not found".
const selectedProjects = parseSelectedProjects(process.argv.slice(2))
const realOnly = selectedProjects.length > 0 && selectedProjects.every((p) => p === 'real-backend')

const realBackendProject = {
  name: 'real-backend',
  use: { ...devices['Desktop Chrome'], baseURL: process.env.TEST_BASE_URL },
  grep: /@real/,
}

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

  // Build + preview the SPA locally for the mocked projects. Skipped only when
  // real-backend is the sole selected project (it targets a remote deployment).
  // NUXT_PUBLIC_API_BASE_URL is forced empty so the built SPA issues same-origin,
  // relative `/api/**` calls (see lib/api/client.ts getApiBaseUrl) — a hard
  // requirement for Playwright's page.route('**/api/**') to intercept them.
  webServer: realOnly
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
      // Mobile smoke subset: tests tagged @mobile re-run under a real device
      // descriptor (viewport, DPR, touch, mobile UA) instead of relying solely
      // on ad-hoc setViewportSize calls inside desktop-project tests.
      name: 'mobile-chromium-mocked',
      use: { ...devices['Pixel 7'], baseURL: 'http://localhost:3000' },
      grep: /@mobile/,
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
    // Only register real-backend when TEST_BASE_URL is set. Without it a bare run
    // omits the project (no undefined-baseURL failures) and an explicit
    // `--project=real-backend` fails fast with Playwright's "project not found".
    ...(process.env.TEST_BASE_URL ? [realBackendProject] : []),
  ],
})

// Collect --project values from argv. Supports both `--project=x` and `--project x`
// forms and is repeatable, mirroring how Playwright itself parses the flag.
function parseSelectedProjects(argv: string[]): string[] {
  const projects: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--project') {
      const next = argv[i + 1]
      if (next !== undefined) projects.push(next)
    } else if (arg?.startsWith('--project=')) {
      projects.push(arg.slice('--project='.length))
    }
  }
  return projects
}
