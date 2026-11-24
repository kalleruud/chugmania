import { compile } from '@tailwindcss/node'
import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'

const ROOT = path.resolve(import.meta.dir, '..')
const ASSET_BRANCH = 'issue-assets'
const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  'chromium',
  'chromium-browser',
  'google-chrome',
  'google-chrome-stable',
]

const MEASURE_HEIGHT = 844
const MEASURE_SCRIPT = `<script>addEventListener('load', () => document.fonts.ready.then(() => document.body.setAttribute('data-height', Math.ceil(document.getElementById('mockup').getBoundingClientRect().height))))</script>`

const USAGE = `Usage:
  bun run mockup render <file.html> [--width 390] [--height <px>]
  bun run mockup publish <slug> <file.png>...`

async function buildCss(html: string): Promise<string> {
  const base = path.join(ROOT, 'frontend')
  const css = await readFile(path.join(base, 'index.css'), 'utf8')
  const compiler = await compile(css, { base, onDependency: () => {} })
  const candidates = [
    ...html.matchAll(/(?<![\w-])class=(["'])(.*?)\1/gs),
  ].flatMap(match => match[2].split(/\s+/))
  return compiler.build(candidates)
}

function wrapHtml(fragment: string, css: string): string {
  return `<!doctype html><html class="dark"><head><meta charset="utf-8"><style>${css}</style></head><body class="min-h-screen font-sans antialiased"><div id="mockup" class="flow-root">${fragment}</div></body></html>`
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
      '--virtual-time-budget=2000',
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
    `${url}?measure`,
  ])
  return Number(/data-height="(\d+)"/.exec(dom)?.[1]) || MEASURE_HEIGHT
}

async function render(file: string, width: number, height?: number) {
  const fragment = await readFile(file, 'utf8')
  const page = wrapHtml(fragment, await buildCss(wrapHtml(fragment, '')))
  const server = Bun.serve({
    port: 0,
    fetch: req => {
      const { pathname } = new URL(req.url)
      if (pathname === '/') {
        const measure = new URL(req.url).searchParams.has('measure')
        const body = measure
          ? page.replace('</body>', `${MEASURE_SCRIPT}</body>`)
          : page
        return new Response(body, { headers: { 'content-type': 'text/html' } })
      }
      const asset = path.join(ROOT, 'public', path.normalize(pathname))
      return existsSync(asset)
        ? new Response(Bun.file(asset))
        : new Response(null, { status: 404 })
    },
  })

  const output = file.replace(/\.html?$/, '') + '.png'
  try {
    const finalHeight = height ?? (await measureHeight(server.url.href, width))
    await runChromium([
      '--force-device-scale-factor=2',
      `--window-size=${width},${finalHeight}`,
      `--screenshot=${path.resolve(output)}`,
      server.url.href,
    ])
  } finally {
    await server.stop(true)
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
  },
})
const [command, ...rest] = positionals

if (command === 'render' && rest.length === 1) {
  const height = values.height ? Number(values.height) : undefined
  await render(rest[0], Number(values.width), height)
} else if (command === 'publish' && rest.length >= 2) {
  await publish(rest[0], rest.slice(1))
} else {
  console.error(USAGE)
  process.exit(1)
}
