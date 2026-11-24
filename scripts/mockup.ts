import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { io } from 'socket.io-client'
import { build } from 'vite'

const ROOT = path.resolve(import.meta.dir, '..')
const HARNESS = path.join(ROOT, 'frontend', 'mockup')
const CACHE = path.join(HARNESS, '.cache')
const ASSET_BRANCH = 'issue-assets'
const PRODUCTION_PORT = '6996'
const DEV_ADMIN = { email: 'admin@chugmania.dev', password: 'chugmania' }
const SNAPSHOT_EVENTS = [
  'user_data',
  'all_users',
  'all_tracks',
  'all_sessions',
  'all_time_entries',
  'all_matches',
  'all_rankings',
  'all_chug_times',
  'active_entry_overrides',
  'all_tournaments',
]
const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  'chromium',
  'chromium-browser',
  'google-chrome',
  'google-chrome-stable',
]
const MEASURE_HEIGHT = 844

const USAGE = `Usage:
  bun run mockup render <file.tsx> [--width 390] [--height <px>] [--path /route] [--bare]
  bun run mockup publish <slug> <file.png>...`

type Recording = [string, ...unknown[]][]

function devOrigin(): string {
  const port = process.env.PORT
  if (!port || port === PRODUCTION_PORT)
    throw new Error('Set PORT in .env to the development port, not production.')
  return `http://localhost:${port}`
}

async function isUp(origin: string): Promise<boolean> {
  try {
    return (await fetch(`${origin}/api/ping`)).ok
  } catch {
    return false
  }
}

async function startDevServer(origin: string) {
  const server = Bun.spawn(['bun', 'backend/src/server.ts'], {
    cwd: ROOT,
    stdout: 'ignore',
    stderr: 'ignore',
  })
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await isUp(origin)) return server
    await Bun.sleep(500)
  }
  server.kill()
  throw new Error(`Development server did not start on ${origin}.`)
}

async function recordFrom(origin: string): Promise<Recording> {
  const login = io(origin, { transports: ['websocket'] })
  const response = await login
    .timeout(10_000)
    .emitWithAck('login', { type: 'LoginRequest', ...DEV_ADMIN })
  login.disconnect()
  if (!response.success) throw new Error(`Login failed: ${response.message}`)

  const socket = io(origin, {
    transports: ['websocket'],
    auth: { token: response.token },
  })
  const events: Recording = []
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out recording development data.')),
        15_000
      )
      socket.onAny((event: string, ...args: unknown[]) => {
        if (!SNAPSHOT_EVENTS.includes(event)) return
        events.push([event, ...args])
        const seen = new Set(events.map(([name]) => name))
        if (SNAPSHOT_EVENTS.every(name => seen.has(name))) {
          clearTimeout(timer)
          resolve()
        }
      })
    })
  } finally {
    socket.disconnect()
  }
  return events.map(([event, ...args]) =>
    event === 'user_data'
      ? [event, { ...(args[0] as object), token: 'mockup' }]
      : [event, ...args]
  )
}

async function record(): Promise<Recording> {
  const origin = devOrigin()
  if (await isUp(origin)) return recordFrom(origin)
  const server = await startDevServer(origin)
  try {
    return await recordFrom(origin)
  } finally {
    server.kill()
    await server.exited
  }
}

async function buildMockup(file: string, outDir: string) {
  await rm(CACHE, { recursive: true, force: true })
  await mkdir(CACHE, { recursive: true })
  const entry = path.join(CACHE, `Mockup${path.extname(file)}`)
  await copyFile(file, entry)
  try {
    await build({
      configFile: path.join(ROOT, 'vite.config.ts'),
      root: ROOT,
      logLevel: 'error',
      publicDir: false,
      resolve: {
        alias: {
          'socket.io-client': path.join(HARNESS, 'socket.ts'),
          'virtual:mockup': entry,
        },
      },
      build: {
        outDir,
        emptyOutDir: true,
        rolldownOptions: { input: path.join(HARNESS, 'index.html') },
      },
    })
  } finally {
    await rm(CACHE, { recursive: true, force: true })
  }
}

function findChromium(): string {
  for (const candidate of CHROMIUM_CANDIDATES) {
    if (!candidate) continue
    const resolved = Bun.which(candidate)
    if (resolved) return resolved
  }
  throw new Error('Chromium not found. Install it or set CHROMIUM_PATH.')
}

async function runChromium(args: string[]): Promise<string> {
  const profile = path.join(tmpdir(), `mockup-${process.pid}-${Date.now()}`)
  const proc = Bun.spawn(
    [
      findChromium(),
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--virtual-time-budget=5000',
      `--user-data-dir=${profile}`,
      ...args,
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  )
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  await rm(profile, { recursive: true, force: true })
  if (exitCode !== 0) throw new Error(stderr)
  return stdout
}

async function measureHeight(url: string, width: number): Promise<number> {
  const dom = await runChromium([
    `--window-size=${width},${MEASURE_HEIGHT}`,
    '--dump-dom',
    url,
  ])
  const error = /data-error="([^"]*)"/.exec(dom)?.[1]
  if (error) throw new Error(`Mockup failed: ${error}`)
  const height = /data-height="(\d+)"/.exec(dom)?.[1]
  if (!height) throw new Error('Mockup never finished loading.')
  return Number(height) || MEASURE_HEIGHT
}

function serve(outDir: string, page: string) {
  return Bun.serve({
    port: 0,
    fetch: req => {
      const { pathname } = new URL(req.url)
      for (const dir of [outDir, path.join(ROOT, 'public')]) {
        const asset = path.join(dir, path.normalize(pathname))
        if (pathname !== '/' && existsSync(asset) && Bun.file(asset).size)
          return new Response(Bun.file(asset))
      }
      return new Response(page, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    },
  })
}

async function render(
  file: string,
  options: { width: number; height?: number; route: string; bare: boolean }
) {
  const outDir = path.join(tmpdir(), `mockup-build-${process.pid}`)
  const [events] = await Promise.all([record(), buildMockup(file, outDir)])
  const html = await readFile(
    path.join(outDir, 'frontend', 'mockup', 'index.html'),
    'utf8'
  )
  const data = JSON.stringify({ events, bare: options.bare }).replaceAll(
    '<',
    String.raw`<`
  )
  const page = html.replace(
    '</head>',
    `<script>window.mockup = ${data}</script></head>`
  )

  const server = serve(outDir, page)
  const url = new URL(options.route, server.url).href
  const output = file.replace(/\.[jt]sx?$/, '') + '.png'
  try {
    const measured = await measureHeight(url, options.width)
    await runChromium([
      '--force-device-scale-factor=2',
      `--window-size=${options.width},${options.height ?? measured}`,
      `--screenshot=${path.resolve(output)}`,
      url,
    ])
  } finally {
    await server.stop(true)
    await rm(outDir, { recursive: true, force: true })
  }
  console.log(output)
}

async function gh(args: string[], input?: object): Promise<unknown> {
  const proc = Bun.spawn(
    ['gh', 'api', ...args, ...(input ? ['--input', '-'] : [])],
    {
      stdin: input ? new Blob([JSON.stringify(input)]) : 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    }
  )
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (exitCode !== 0) throw new Error(stderr || stdout)
  return JSON.parse(stdout)
}

async function ghOptional(args: string[]): Promise<unknown> {
  try {
    return await gh(args)
  } catch {
    return undefined
  }
}

async function ensureAssetBranch(repo: string) {
  if (await ghOptional([`repos/${repo}/git/ref/heads/${ASSET_BRANCH}`])) return

  const tree = (await gh(['-X', 'POST', `repos/${repo}/git/trees`], {
    tree: [
      {
        path: 'README.md',
        mode: '100644',
        type: 'blob',
        content:
          'Mockup images embedded in issues. Created by `bun run mockup publish`.\n',
      },
    ],
  })) as { sha: string }
  const commit = (await gh(['-X', 'POST', `repos/${repo}/git/commits`], {
    message: 'Start issue mockup assets',
    tree: tree.sha,
    parents: [],
  })) as { sha: string }
  await gh(['-X', 'POST', `repos/${repo}/git/refs`], {
    ref: `refs/heads/${ASSET_BRANCH}`,
    sha: commit.sha,
  })
}

async function publish(slug: string, files: string[]) {
  const { nameWithOwner } = JSON.parse(
    Bun.spawnSync([
      'gh',
      'repo',
      'view',
      '--json',
      'nameWithOwner',
    ]).stdout.toString()
  ) as { nameWithOwner: string }
  await ensureAssetBranch(nameWithOwner)

  for (const file of files) {
    const target = `${slug}/${encodeURIComponent(path.basename(file))}`
    const existing = (await ghOptional([
      `repos/${nameWithOwner}/contents/${target}?ref=${ASSET_BRANCH}`,
    ])) as { sha: string } | undefined
    const content = Buffer.from(await readFile(file)).toString('base64')
    const result = (await gh(
      ['-X', 'PUT', `repos/${nameWithOwner}/contents/${target}`],
      {
        message: `Add mockup ${target}`,
        branch: ASSET_BRANCH,
        content,
        sha: existing?.sha,
      }
    )) as { commit: { sha: string } }
    console.log(
      `![${path.basename(file, path.extname(file))}](https://raw.githubusercontent.com/${nameWithOwner}/${result.commit.sha}/${target})`
    )
  }
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    width: { type: 'string', default: '390' },
    height: { type: 'string' },
    path: { type: 'string', default: '/' },
    bare: { type: 'boolean', default: false },
  },
})
const [command, ...rest] = positionals

if (command === 'render' && rest.length === 1) {
  await render(rest[0], {
    width: Number(values.width),
    height: values.height ? Number(values.height) : undefined,
    route: values.path,
    bare: values.bare,
  })
} else if (command === 'publish' && rest.length >= 2) {
  await publish(rest[0], rest.slice(1))
} else {
  console.error(USAGE)
  process.exit(1)
}
