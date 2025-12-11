// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Your custom configs here
  {
    ignores: [
      'node_modules/**',
      '.output/**',
      '.nuxt/**',
      '.nitro/**',
      '.cache/**',
      'dist/**',
      'coverage/**',
      '*.min.js',
      '*.min.css',
      'public/**',
      '.vscode/**',
      '.idea/**'
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        projectService: {
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 100,
          allowDefaultProject: [
            '*.config.ts',
            '*.config.js',
            '*.config.mjs',
            'app.config.ts',
            'playwright.config.ts',
            'vitest.config.ts',
            'postcss.config.js',
            'lib/api/*.ts',
            'lib/api/interceptors/*.ts',
            'lib/api/services/*.ts',
            'lib/api/services/__tests__/*.ts',
            'lib/config/*.ts',
            'lib/errors/*.ts',
            'lib/errors/__tests__/*.ts',
            'lib/signalr/*.ts',
            'composables/*.ts',
            'plugins/*.ts',
            'plugins/*.client.ts',
            'stores/*.ts',
            'stores/__tests__/*.ts',
            'tests/*.ts',
            'tests/mocks/*.ts',
            'tests/setup.ts',
            'tests/utils.ts',
            'tests/unit/composables/*.ts',
            'tests/unit/signalr/*.ts',
            'tests/unit/components/chats/*.ts',
            'tests/unit/middleware/*.ts',
            'tests/unit/pages/*.ts',
            'tests/integration/*.ts',
            'types/api/*.ts',
            'types/domain/*.ts',
            'types/enums/*.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      "@typescript-eslint/no-deprecated": "error",
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/multi-word-component-names': 'off',
      'prefer-const': 'error',
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

    }
  }
)
