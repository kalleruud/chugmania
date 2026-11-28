import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@common/models/socket.io'
import { Database } from 'bun:sqlite'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { io, type Socket } from 'socket.io-client'

const PRODUCTION_PORT = 6996
const BRANCH = 'screenshots'
const DEV_ADMIN = { email: 'admin@chugmania.dev', password: 'chugmania' }
const SIZES = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
}

type Size = keyof typeof SIZES
type Shot = { route: string; size: Size; file: string }
type Manifest = { anonymized: boolean; shots: Shot[] }

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    login: { type: 'string', default: 'guest' },
    theme: { type: 'string', default: 'dark' },
    size: { type: 'string', multiple: true },
    wait: { type: 'string' },
    viewport: { type: 'boolean', default: false },
    out: { type: 'string', default: '.screenshots' },
    publish: { type: 'string' },
    anonymize: { type: 'boolean', default: false },
  },
})

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const port = Number(process.env.PORT)
if (!Number.isInteger(port) || port <= 0 || port === PRODUCTION_PORT)
  fail(`Set PORT in .env to the dev server port. Never use ${PRODUCTION_PORT}.`)
const baseUrl = `http://localhost:${port}`

const routes = positionals.length ? positionals : ['/']
for (const route of routes)
  if (!route.startsWith('/') || new URL(route, baseUrl).origin !== baseUrl)
    fail(`Route ${route} must be a path on the dev server, such as /sessions.`)
const sizes = (values.size ?? Object.keys(SIZES)) as Size[]
for (const size of sizes)
  if (!(size in SIZES)) fail(`Unknown size ${size}. Use phone or desktop.`)
if (values.publish && !/^[\w.-]+$/.test(values.publish))
  fail('--publish takes a label such as pr-123 or issue-45.')

function credentials(login: string) {
  if (login === 'guest') return undefined
  if (login === 'admin') return DEV_ADMIN
  const separator = login.indexOf(':')
  if (separator < 1) fail('--login takes guest, admin or email:password.')
  return {
    email: login.slice(0, separator),
    password: login.slice(separator + 1),
  }
}

async function loginToken(login: string) {
  const user = credentials(login)
  if (!user) return undefined
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    baseUrl,
    { transports: ['websocket'] }
  )
  const response = await socket
    .timeout(10_000)
    .emitWithAck('login', { type: 'LoginRequest', ...user })
  socket.disconnect()
  if (!response.success)
    fail(`Login as ${user.email} failed: ${response.message}`)
  return response.token
}

type UserRow = {
  email: string
  firstName: string
  lastName: string | null
  shortName: string | null
}

function pseudonyms() {
  const db = new Database(process.env.DATABASE_PATH ?? 'data/db.sqlite', {
    readonly: true,
  })
  const users = db
    .query<UserRow, [string]>(
      'select email, first_name as firstName, last_name as lastName, short_name as shortName from users where email != ? order by created_at'
    )
    .all(DEV_ADMIN.email)
  db.close()
  const pairs = users.flatMap((user, index) => {
    const number = String(index + 1)
    const replacements: [string | null, string][] = [
      [user.email, `spiller${number}@example.com`],
      [user.firstName, 'Spiller'],
      [user.lastName, number],
      [user.shortName, `S${number.padStart(2, '0')}`],
    ]
    return replacements.filter((pair): pair is [string, string] =>
      Boolean(pair[0]?.trim())
    )
  })
  return pairs.sort(([a], [b]) => b.length - a.length)
}

function replaceNames(pairs: [string, string][]) {
  const patterns = pairs.map(([name, alias]) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return [
      new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu'),
      alias,
    ] as [RegExp, string]
  })
  const replace = (text: string) =>
    patterns.reduce(
      (value, [pattern, alias]) => value.replace(pattern, alias),
      text
    )
  const replaceIn = (root: Node) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (
      let node: Node | null = walker.currentNode;
      node;
      node = walker.nextNode()
    ) {
      if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue) continue
      const value = replace(node.nodeValue)
      if (value !== node.nodeValue) node.nodeValue = value
    }
    if (root instanceof Element)
      for (const input of [root, ...root.querySelectorAll('input, textarea')])
        if (
          input instanceof HTMLInputElement ||
          input instanceof HTMLTextAreaElement
        )
          input.value = replace(input.value)
  }
  replaceIn(document.body)
  new MutationObserver(mutations => {
    for (const mutation of mutations)
      if (mutation.type === 'characterData') replaceIn(mutation.target)
      else mutation.addedNodes.forEach(replaceIn)
  }).observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  })
}

function slug(route: string) {
  const name = route.replace(/^\/+|\/+$/g, '').replace(/[^\w-]+/g, '-')
  return name || 'home'
}

async function capture(
  token: string | undefined,
  outDir: string,
  anonymize: boolean
) {
  const names = anonymize ? pseudonyms() : []
  const browser = await chromium.launch()
  const shots: Shot[] = []
  try {
    for (const size of sizes) {
      const context = await browser.newContext({ viewport: SIZES[size] })
      await context.addInitScript(
        ([theme, token]) => {
          localStorage.setItem('theme', theme)
          if (token) localStorage.setItem('auth', token)
        },
        [values.theme, token ?? ''] satisfies [string, string]
      )
      const page = await context.newPage()
      for (const [index, route] of routes.entries()) {
        await page.goto(new URL(route, baseUrl).href, { waitUntil: 'load' })
        if (values.wait)
          await page
            .getByText(values.wait)
            .filter({ visible: true })
            .first()
            .waitFor({ timeout: 15_000 })
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(1_500)
        if (anonymize) await page.evaluate(replaceNames, names)
        const file = `${index + 1}-${slug(route)}--${size}.png`
        await page.screenshot({
          path: path.join(outDir, file),
          fullPage: !values.viewport,
          animations: 'disabled',
        })
        shots.push({ route, size, file })
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }
  return shots
}

async function gh(args: string[], body?: unknown) {
  const child = Bun.spawn(['gh', ...args], {
    stdin: body === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (body !== undefined && child.stdin) {
    await child.stdin.write(JSON.stringify(body))
    await child.stdin.end()
  }
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), ok: code === 0 }
}

async function ghJson<T>(args: string[], body?: unknown) {
  const result = await gh(args, body)
  if (!result.ok) fail(`gh ${args.join(' ')} failed: ${result.stderr}`)
  return JSON.parse(result.stdout) as T
}

async function ensureBranch(repo: string) {
  if ((await gh(['api', `repos/${repo}/branches/${BRANCH}`])).ok) return
  const tree = await ghJson<{ sha: string }>(
    ['api', '-X', 'POST', `repos/${repo}/git/trees`, '--input', '-'],
    {
      tree: [
        {
          path: 'README.md',
          mode: '100644',
          type: 'blob',
          content:
            'Screenshots for issues and pull requests, uploaded by `scripts/screenshot.ts`.\n',
        },
      ],
    }
  )
  const commit = await ghJson<{ sha: string }>(
    ['api', '-X', 'POST', `repos/${repo}/git/commits`, '--input', '-'],
    { message: 'Start screenshots branch', tree: tree.sha, parents: [] }
  )
  await ghJson(
    ['api', '-X', 'POST', `repos/${repo}/git/refs`, '--input', '-'],
    {
      ref: `refs/heads/${BRANCH}`,
      sha: commit.sha,
    }
  )
}

async function publish(label: string, outDir: string, shots: Shot[]) {
  const repo = (
    await ghJson<{ nameWithOwner: string }>([
      'repo',
      'view',
      '--json',
      'nameWithOwner',
    ])
  ).nameWithOwner
  await ensureBranch(repo)
  const folder = `${label}/${new Date().toISOString().replace(/[:.]/g, '-')}`
  const urls = new Map<string, string>()
  for (const shot of shots) {
    const remotePath = `${folder}/${shot.file}`
    await ghJson(
      [
        'api',
        '-X',
        'PUT',
        `repos/${repo}/contents/${remotePath}`,
        '--input',
        '-',
      ],
      {
        message: `Add ${remotePath}`,
        branch: BRANCH,
        content: readFileSync(path.join(outDir, shot.file)).toString('base64'),
      }
    )
    urls.set(
      shot.file,
      `https://raw.githubusercontent.com/${repo}/${BRANCH}/${remotePath}`
    )
  }
  return urls
}

function markdown(shots: Shot[], urls: Map<string, string>) {
  const routes = [...new Set(shots.map(shot => shot.route))]
  const sizes = [...new Set(shots.map(shot => shot.size))]
  return routes
    .map(route => {
      const row = sizes.map(size => {
        const shot = shots.find(s => s.route === route && s.size === size)
        const url = shot && urls.get(shot.file)
        return url
          ? `<img src="${url}" width="${size === 'phone' ? 260 : 480}">`
          : ''
      })
      return `**\`${route}\`**\n\n| ${sizes.join(' | ')} |\n| ${sizes.map(() => '---').join(' | ')} |\n| ${row.join(' | ')} |`
    })
    .join('\n\n')
}

const outDir = path.resolve(values.out)
const manifestFile = path.join(outDir, 'shots.json')

if (values.publish) {
  if (!existsSync(manifestFile))
    fail(`Capture with --anonymize into ${outDir} before publishing it.`)
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as Manifest
  if (!manifest.anonymized)
    fail(`Capture with --anonymize before publishing ${outDir}.`)
  const urls = await publish(values.publish, outDir, manifest.shots)
  const md = markdown(manifest.shots, urls)
  writeFileSync(path.join(outDir, 'comment.md'), `${md}\n`)
  console.log(`${md}\n\nMarkdown saved to ${path.join(outDir, 'comment.md')}`)
} else {
  mkdirSync(outDir, { recursive: true })
  rmSync(manifestFile, { force: true })
  const anonymized = values.anonymize
  const shots = await capture(
    await loginToken(values.login),
    outDir,
    anonymized
  )
  writeFileSync(
    manifestFile,
    `${JSON.stringify({ anonymized, shots } satisfies Manifest, null, 2)}\n`
  )
  for (const shot of shots) console.log(path.join(outDir, shot.file))
}
