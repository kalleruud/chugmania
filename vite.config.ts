import { defineConfig } from 'vitest/config'
import { sveltekit } from '@sveltejs/kit/vite'

export default defineConfig({
  plugins: [sveltekit()],

  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      include: ['src/**/*.{js,ts}'],
      reporter: ['text', 'json-summary', 'json'],
      reportOnFailure: true,
    },
  },
})
