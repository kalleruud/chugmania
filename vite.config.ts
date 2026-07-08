import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 6996

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend'),
      '@common': path.resolve(__dirname, './common'),
    },
  },
  server: {
    ws: {
      clientPort: port + 1,
      port: port + 1,
    },
  },
})
