import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 6996

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ plugins: ['babel-plugin-react-compiler'] }),
    tailwindcss(),
  ],
  optimizeDeps: {
    include: ['react/compiler-runtime'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './frontend'),
      '@common': path.resolve(import.meta.dirname, './common'),
    },
  },
  build: {
    rolldownOptions: {
      checks: { bundlerTimings: false },
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules\/(react|react-dom|scheduler)\//,
            },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
  server: {
    ws: {
      clientPort: port + 1,
      port: port + 1,
    },
  },
})
