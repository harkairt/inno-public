import withNuxt from './.nuxt/eslint.config.mjs'
import eslintConfigPrettier from 'eslint-config-prettier'
import pluginQuery from '@tanstack/eslint-plugin-query'
import sonarjs from 'eslint-plugin-sonarjs'
import regexp from 'eslint-plugin-regexp'

export default withNuxt(
  ...pluginQuery.configs['flat/recommended'],
  regexp.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.vue'],
    plugins: { sonarjs },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/no-commented-code': 'warn',
      'sonarjs/no-invariant-returns': 'warn',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/slow-regex': 'warn',
    },
  },
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
      '.idea/**',
      // Agent-isolation worktrees are full repo copies; linting them double-counts
      // every file (and their paths aren't in tsconfig.eslint.json → parse errors).
      '.claude/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'error',
      'prefer-const': 'error',
      'no-console': 'warn',
      // Modern null/undefined handling
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@tanstack/query/exhaustive-deps': [
        'error',
        {
          allowlist: {
            variables: ['authStore'],
          },
        },
      ],
      // AI code quality guards
      complexity: ['warn', { max: 15 }],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 4],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      complexity: 'off',
      'max-depth': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-identical-functions': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
    },
  },
  eslintConfigPrettier,
)
