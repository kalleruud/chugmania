/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts*', '**/*.spec.ts*'],
    exclude: ['node_modules/**', 'dist/**', '.**'],
    env: {
      SECRET: 'test',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['backend/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend'),
      '@common': path.resolve(__dirname, './common'),
      '@backend': path.resolve(__dirname, './backend'),
    },
  },
})
