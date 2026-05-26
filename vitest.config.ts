/**
 * Vitest configuration
 * Provides comprehensive testing setup for the application
 */

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'url'

export default defineConfig({
  plugins: [vue()],

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
    exclude: [
      'node_modules',
      'dist',
      '.nuxt',
      '.output',
      'tests/e2e/**',
      // These test files reference components that don't exist yet
      'tests/unit/components/chats/**',
    ],

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
        global: {
          // Ratcheted (2026-05-12): stmts 43.2%, branches 78%, fns 54.2%, lines 43.2%.
          // Coverage includes app/stores, app/composables, app/utils, lib/.
          // Set to actual - 2% to allow refactoring headroom.
          branches: 76,
          functions: 52,
          lines: 41,
          statements: 41,
        },
      },
    },

    // Test timeout
    testTimeout: 10000,

    // Hook timeout
    hookTimeout: 10000,

    // Enable test isolation
    isolate: true,

    // Watch mode settings
    watchExclude: ['node_modules', 'dist', '.nuxt', '.output'],
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '@@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },

  // Define global constants
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },

  // Environment-specific configuration
  env: {
    NODE_ENV: 'test',
    NUXT_PUBLIC_API_BASE_URL: 'http://localhost:3000',
  },
})
