import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'

test('dev middleware transforms the app through the tsx Node loader', async () => {
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile(
      'node',
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `
      import assert from 'node:assert/strict'
      import { createServer } from 'vite'

      const server = await createServer({
        server: { middlewareMode: true, ws: false },
      })
      try {
        const app = await server.transformRequest('/frontend/App.tsx')
        assert.ok(app?.code.includes('createRoot'))
        const layout = await server.transformRequest('/frontend/app/Layout.tsx')
        assert.ok(layout?.code.includes('compiler-runtime'))
        console.log('Dev transforms passed')
      } finally {
        await server.close()
      }
    `,
      ],
      (error, stdout) => {
        if (error) reject(new Error(error.message, { cause: error }))
        else resolve(stdout)
      }
    )
  })
  assert.ok(stdout.includes('Dev transforms passed'), JSON.stringify(stdout))
}, 30_000)
