import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import express from 'express'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { timeEntries } from '../backend/database/schema'
import { createPreviewRouter } from '../backend/src/endpoints/preview'
import SessionManager from '../backend/src/managers/session.manager'
import { db } from './setup'
import {
  assertResponse,
  createSession,
  createTracks,
  createUser,
  login,
} from './utils'

const ORIGIN = new URL('https://chugmania.test')
const TEMPLATE =
  '<!doctype html><html><head><title>Chugmania</title></head><body></body></html>'

let baseUrl: string
let close: () => void

beforeAll(async () => {
  const app = express()
  app.use(createPreviewRouter(ORIGIN, () => Promise.resolve(TEMPLATE)))
  app.use((_req, res) => {
    res.status(404).send('fallthrough')
  })
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  close = () => server.close()
})

afterAll(() => close())

function getMeta(html: string, key: string): string | undefined {
  const match = new RegExp(
    `<meta (?:property|name)="${key}" content="([^"]*)" />`
  ).exec(html)
  return match?.[1]
}

async function fetchPage(pathname: string): Promise<string> {
  const res = await fetch(baseUrl + pathname)
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('text/html')
  return res.text()
}

function getPngSize(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

describe('page link previews', () => {
  test('session pages describe the session and link a matching image', async () => {
    const moderator = createUser('preview-mod', 'moderator')
    const guest = createUser('preview-guest')
    const socket = await login(moderator)
    const session = await createSession(socket, [
      { user: moderator.id, response: 'yes' },
      { user: guest.id, response: 'no' },
    ])
    await SessionManager.onEditSession(socket, {
      type: 'EditSessionRequest',
      id: session.id,
      name: 'Fredags <Cup> & "venner" $$ $&',
      location: 'Garasjen',
      description: '## Info\n**Ta med** [kontroller](https://x.test)!',
      date: new Date('2030-06-07T17:00:00Z'),
    }).then(assertResponse)

    const html = await fetchPage(`/sessions/${session.id}`)

    expect(html).toContain('<title>Chugmania</title>')
    expect(html).not.toContain('<Cup>')
    expect(getMeta(html, 'og:title')).toBe(
      'Fredags &lt;Cup&gt; &amp; &quot;venner&quot; $$ $&amp;'
    )
    expect(getMeta(html, 'og:description')).toBe(
      'Fredag 7. juni 2030 kl. 19:00 · Garasjen · 1 påmeldt. Info Ta med kontroller!'
    )
    expect(getMeta(html, 'og:url')).toBe(
      `https://chugmania.test/sessions/${session.id}`
    )
    expect(getMeta(html, 'twitter:card')).toBe('summary_large_image')

    const image = new URL(getMeta(html, 'og:image') ?? '')
    expect(image.origin).toBe(ORIGIN.origin)
    expect(image.pathname).toBe(`/api/preview/sessions/${session.id}.png`)
    expect(image.searchParams.get('v')).toMatch(/^[0-9a-f]{12}$/)

    const nested = await fetchPage(
      `/sessions/${session.id}/tournament/groups/any-group`
    )
    expect(getMeta(nested, 'og:title')).toBe(getMeta(html, 'og:title'))
  })

  test('track pages show the record holder and number of drivers', async () => {
    const [track] = createTracks()
    const fast = createUser('preview-fast')
    const slow = createUser('preview-slow')
    const gone = createUser('preview-gone')
    db.insert(timeEntries)
      .values([
        { track: track.id, user: slow.id, duration: 45_000 },
        { track: track.id, user: fast.id, duration: 42_123 },
        { track: track.id, user: fast.id, duration: 43_000 },
        {
          track: track.id,
          user: gone.id,
          duration: 30_000,
          deletedAt: new Date(),
        },
        { track: track.id, user: slow.id, duration: 1, status: 'cancelled' },
      ])
      .run()

    const html = await fetchPage(`/tracks/${track.id}`)

    expect(getMeta(html, 'og:title')).toBe(`#${track.name}`)
    expect(getMeta(html, 'og:description')).toBe(
      'Rekord 42.123 av preview-fast · 2 spillere · Trackmania Turbo · Stadium'
    )
  })

  test('user pages show the player name', async () => {
    const user = createUser('preview-player')

    const html = await fetchPage(`/users/${user.id}`)

    expect(getMeta(html, 'og:title')).toBe('preview-player')
    expect(getMeta(html, 'og:description')).toBe(
      `Chugget siden ${new Date().getFullYear()}`
    )
  })

  test('list pages and unknown records fall back to readable defaults', async () => {
    const tracks = await fetchPage('/tracks')
    expect(getMeta(tracks, 'og:title')).toBe('Baner')
    expect(getMeta(tracks, 'og:image')).toStartWith(
      'https://chugmania.test/api/preview/tracks.png?v='
    )

    const home = await fetchPage('/')
    expect(getMeta(home, 'og:title')).toBe('Chugmania')
    expect(getMeta(home, 'og:image')).toStartWith(
      'https://chugmania.test/api/preview/index.png?v='
    )

    const missing = await fetchPage('/sessions/does-not-exist')
    expect(getMeta(missing, 'og:title')).toBe('Chugmania')
  })

  test('preview images are 1200x630 PNG cards', async () => {
    const [track] = createTracks()

    const res = await fetch(`${baseUrl}/api/preview/tracks/${track.id}.png`)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    const png = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(png.subarray(1, 4))).toEqual([0x50, 0x4e, 0x47])
    expect(getPngSize(png)).toEqual({ width: 1200, height: 630 })

    const home = await fetch(`${baseUrl}/api/preview/index.png`)
    expect(home.status).toBe(200)
  }, 30_000)

  test('asset and API requests are not served as pages', async () => {
    for (const pathname of [
      '/frontend/App.tsx',
      '/@vite/client',
      '/api/unknown',
      '/api/preview/tracks',
    ]) {
      const res = await fetch(baseUrl + pathname)
      assert.equal(res.status, 404, pathname)
    }
  })
})
