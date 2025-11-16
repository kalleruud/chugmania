import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

function getContentType(ext: string): string {
  if (ext === '.woff2') return 'font/woff2'
  if (ext === '.woff') return 'font/woff'
  return 'application/octet-stream'
}

export default function serveFontsPlugin(): Plugin {
  return {
    name: 'serve-titillium-fonts-dev',
    apply: 'serve',
    configureServer(server) {
      return () => {
        server.middlewares.use('/fonts/titillium-web/', (req, res, next) => {
          const filename = req.url?.split('?')[0] || ''
          const filePath = path.resolve(
            __dirname,
            `node_modules/@fontsource/titillium-web/files/${filename}`
          )

          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath)
            const ext = path.extname(filename)
            const contentType = getContentType(ext)

            res.setHeader('Content-Type', contentType)
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Cache-Control', 'public, max-age=31536000')
            res.end(content)
          } else {
            next()
          }
        })
      }
    },
  }
}
