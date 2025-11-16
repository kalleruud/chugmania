import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import serveFontsPlugin from './vite-plugin-serve-fonts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
    serveFontsPlugin(),
    {
      name: 'copy-titillium-fonts',
      apply: 'build',
      generateBundle() {
        const srcDir = path.resolve(
          __dirname,
          'node_modules/@fontsource/titillium-web/files'
        )
        const files = fs
          .readdirSync(srcDir)
          .filter(f => f.endsWith('.woff') || f.endsWith('.woff2'))

        files.forEach(file => {
          const content = fs.readFileSync(path.join(srcDir, file))
          this.emitFile({
            type: 'asset',
            fileName: `fonts/titillium-web/${file}`,
            source: content,
          })
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend'),
    },
  },
})
