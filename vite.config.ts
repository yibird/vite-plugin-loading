import { defineConfig } from 'vite-plus'

export default defineConfig({
  lint: {
    env: {
      browser: true,
      es2023: true,
      node: true,
    },
    ignorePatterns: ['dist/**', 'node_modules/**', 'public/**'],
    rules: {
      'no-debugger': 'error',
      'no-unused-vars': 'error',
      'typescript/no-explicit-any': 'off',
    },
  },
  fmt: {
    printWidth: 100,
    singleQuote: true,
    trailingComma: 'all',
    semi: false,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
