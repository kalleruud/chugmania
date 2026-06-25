import eslint from '@eslint/js'
import importPlugin from 'eslint-plugin-import'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import { configs as tseslint } from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'scripts/*', '*.d.ts']),
  eslint.configs.recommended,
  tseslint.strictTypeChecked,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.react,
  importPlugin.flatConfigs.typescript,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'import/no-unresolved': 'off',
      'no-restricted-imports': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['./frontend/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@backend/*'],
              message: 'Frontend code cannot import backend-only modules.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['./backend/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/*'],
              message: 'Backend code cannot import frontend modules.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    // Ignore vite-express import issue
    files: ['./backend/src/server.ts'],
    rules: {
      'import/default': 'off',
    },
  },
  {
    files: ['./common/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/*', '@backend/*'],
              message: 'Common code cannot import frontend or backend modules.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
])
