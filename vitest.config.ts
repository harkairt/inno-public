/**
 * Vitest configuration
 * Provides comprehensive testing setup for the application
 */

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'url'

/**
 * Inline Nuxt's `import.meta.client` as `true` for the test build. InnoChat is a
 * client-only SPA (ssr: false), so this flag is always true at runtime in Nuxt;
 * Vitest has no Nuxt build and Vite's `define` ignores `import.meta.*` keys, so a
 * transform is needed for client-guarded branches (config-init CSS) to execute.
 */
const inlineImportMetaClient = {
  name: 'inline-import-meta-client',
  enforce: 'pre' as const,
  transform(code: string) {
    if (!code.includes('import.meta.client')) return null
    return { code: code.replace(/import\.meta\.client/g, 'true'), map: null }
  },
}

export default defineConfig({
  plugins: [inlineImportMetaClient, vue()],

  test: {
    globals: true,
    environment: 'happy-dom',

    // Setup files to run before each test file
    setupFiles: ['./tests/setup.ts'],

    // Test file patterns
    include: [
      'tests/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'lib/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'stores/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'composables/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'types/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],

    // Exclude patterns
    exclude: ['node_modules', 'dist', '.nuxt', '.output', 'tests/e2e/**'],

    // Environment configuration (read by Vitest — root-level `env` is ignored)
    env: {
      NODE_ENV: 'test',
      NUXT_PUBLIC_API_BASE_URL: 'http://localhost:3000',
    },
    environmentOptions: {
      happyDOM: { url: 'http://localhost:3000' }, // make origin explicit, don't rely on default
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'lib/**/*.{js,ts}',
        'app/stores/**/*.{js,ts}',
        'app/composables/**/*.{js,ts}',
        'app/utils/**/*.{js,ts}',
        'types/**/*.{ts}',
        'app/components/**/*.{vue,ts}',
        'app/pages/**/*.vue',
        'app/plugins/**/*.ts',
        'app/middleware/**/*.ts',
      ],
      exclude: [
        'lib/**/__tests__/**',
        'app/stores/**/__tests__/**',
        'app/composables/**/__tests__/**',
        'types/**/__tests__/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
      ],
      thresholds: {
        // GLOBAL thresholds are the top-level keys directly under `thresholds`
        // (Vitest has NO `global` sub-object — that is Jest's shape; a `global:`
        // key here is silently parsed as a glob matching no files and dropped,
        // so the global gate would never fire). Glob-pattern keys are siblings.
        //
        // Ratcheted (2026-07-06): coverage include widened to components/pages/plugins/middleware.
        // Numbers DROPPED vs the prior ratchet because the denominator grew — this is the
        // honest baseline, not a regression. Raised per backfill wave (see plans/testing/Phase 2.md).
        // Wave B1 (services + interceptors → MSW): floor(actual − 2).
        // Wave B2 (SignalR subsystem → unit + fakeSignalR): floor(actual − 2).
        // Wave B3 (plugins + public/iframe mode): floor(actual − 2).
        // Wave B4 (remaining composables): floor(actual − 2). branches held at 77
        // (floor(actual − 2) rounds to 77; never lowered).
        // Wave B5 (components): denominator grew again but net coverage rose —
        // lines/statements floor(62 − 2) = 60; branches held at 77; functions
        // held at 70 (floor(71.67 − 2) = 69, never lowered).
        // Wave B6 (pages + middleware + seven integration flows): pages/middleware
        // now covered, so lines/statements jumped to floor(80.04 − 2) = 78;
        // branches held at 77 (actual 79.53 → floor 77); functions held at 70
        // (actual 72.59 → floor 70).
        // Phase 4 (2026-07-08) — critical-file depth (sanitizer, error normalizer,
        // client/interceptor-setup, plugins, layouts) + storage-blocked simulation
        // + token-lifecycle/SignalR/clock backfill (+132 tests). floor(actual − 2):
        // branches 81.07→79, functions 74.52→72, lines/statements 81.84→79.
        branches: 79,
        functions: 72,
        lines: 79,
        statements: 79,
        // Wave B1 per-glob ratchet — floor(actual − 2). The interceptor chain and
        // most services are now driven end-to-end through MSW. lib/api/services is
        // held lower because LogService's specialized logging methods are out of
        // B1 scope (only its POST body-shape + fire-and-forget contract are pinned).
        // Phase 4 (2026-07-08): client.ts + interceptor-setup direct tests
        // pushed the chain higher; floor(actual − 2).
        'lib/api/interceptors/**': {
          branches: 79,
          functions: 98,
          lines: 92,
          statements: 92,
        },
        'lib/api/services/**': {
          branches: 82,
          functions: 73,
          lines: 68,
          statements: 68,
        },
        // Wave B2 per-glob ratchet — floor(actual − 2). SignalRService is driven
        // through a mocked @microsoft/signalr; SignalROperations vs a stub.
        'lib/signalr/**': {
          branches: 84,
          functions: 98,
          lines: 93,
          statements: 93,
        },
        // Wave B2 bumped useSignalR/useSignalRChat via installFakeSignalR; Wave B3
        // added usePublicMode/usePublicChatAgent/useConfig. Wave B4 covered the
        // remaining composables (autoscroll/voice/pwa/relative-date/shiki/chartjs/
        // primary-session/users/nav-visibility/pivot/markdown) + opportunistic
        // chat query/mutation branches. Floor(actual − 2); branches held at 80
        // (actual 80.85 → floor 78, but never lowered below the prior 80).
        // Phase 4 (2026-07-08): useRelativeDate frozen-clock buckets +
        // groupMessages date boundaries; floor(actual − 2), branches held at 80.
        'app/composables/**': {
          branches: 80,
          functions: 78,
          lines: 75,
          statements: 75,
        },
        // Wave B3 per-glob ratchet — floor(actual − 2). config-init/public-auth/
        // vue-query/pinia-persistence/buffer/viewer driven via setup() + MSW; the
        // aggregate is held down by api-interceptors.client.ts + ssr-width.ts,
        // which land in a later wave.
        // Phase 4 (2026-07-08): api-interceptors.client + ssr-width plugins now
        // covered (the two files B3 deferred); floor(actual − 2).
        'app/plugins/**': {
          branches: 67,
          functions: 78,
          lines: 85,
          statements: 85,
        },
        // Wave B5 per-glob ratchet — floor(actual − 2). SFC coverage verified
        // stable across two identical runs (v8 .vue line-mapping did not jitter),
        // so all four metrics are ratcheted, not lines-only. Functions held down
        // by pre-existing partially-tested components (MessageInput,
        // ManageSessionUsers, OptionsMessage) whose full backfill is out of B5 scope.
        // Phase 4 (2026-07-08): ChatListPanel sessionStorage guards nudged
        // component coverage up; floor(actual − 2).
        'app/components/**': {
          branches: 75,
          functions: 51,
          lines: 78,
          statements: 78,
        },
        // Wave B6 per-glob ratchet — floor(actual − 2). Pages rendered as
        // components via renderWithProviders + MSW; the plan's ≈80% lines target
        // is met (82.50% → floor 80). Functions held down by visual/layout
        // branches and page methods pragmatically excluded from B6 scope.
        'app/pages/**': {
          branches: 69,
          functions: 36,
          lines: 80,
          statements: 80,
        },
        // Wave B6 per-glob ratchet — floor(actual − 2). auth.global.ts fully
        // driven by the public/private route matrix (100% lines/functions,
        // 94.12% branches → floor 92).
        'app/middleware/**': {
          branches: 92,
          functions: 98,
          lines: 98,
          statements: 98,
        },
      },
    },

    // Test timeout
    testTimeout: 10000,

    // Hook timeout
    hookTimeout: 10000,

    // Enable test isolation
    isolate: true,
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '@@': fileURLToPath(new URL('./', import.meta.url)),
      // @vite-pwa virtual module only exists in a Nuxt/Vite build; alias it to a
      // controllable test stub so usePWAUpdate's dynamic import resolves.
      'virtual:pwa-register/vue': fileURLToPath(
        new URL('./tests/stubs/pwaRegister.ts', import.meta.url),
      ),
    },
  },

  // Define global constants
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
})
