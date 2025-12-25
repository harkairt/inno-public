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
        project: './tsconfig.eslint.json',
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
      // Modern null/undefined handling
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',

    }
  }
)
