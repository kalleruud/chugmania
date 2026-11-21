import {
  CALENDAR_TOKEN_NAME,
  MAX_API_TOKENS,
  type ApiToken,
} from '@common/models/apiToken'
import type { User } from '@common/models/user'
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import express from 'express'
import jwt from 'jsonwebtoken'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { users } from '../backend/database/schema'
import WebhookSource from '../backend/database/sources/webhook.source'
import { createCalendarRouter } from '../backend/src/endpoints/calendar'
import { createWebhookRouter } from '../backend/src/endpoints/webhook'
import ApiTokenManager from '../backend/src/managers/apiToken.manager'
import AuthManager from '../backend/src/managers/auth.manager'
import SessionManager from '../backend/src/managers/session.manager'
import type { TypedSocket } from '../backend/src/server'
import { apiTokenSockets, db, pendingApiTokenEmits } from './setup'
import { assertResponse, createSession, createUser, login } from './utils'

const DAY_MS = 24 * 60 * 60 * 1000

async function createToken(
  socket: TypedSocket,
  name: string,
  expiresAt?: number | null
) {
  const response = await ApiTokenManager.onCreateApiToken(socket, {
    type: 'CreateApiTokenRequest',
    name,
    expiresAt,
  })
  assertResponse(response)
  return response
}

async function listTokens(socket: TypedSocket): Promise<ApiToken[]> {
  const response = await ApiTokenManager.onGetApiTokens(socket)
  assertResponse(response)
  return response.tokens
}

async function revoke(socket: TypedSocket, id: string) {
  return ApiTokenManager.onRevokeApiToken(socket, {
    type: 'ApiTokenRequest',
    id,
  })
}

describe('creating API tokens', () => {
  test.serial(
    'returns the value once and never includes it in listings',
    async () => {
      const socket = await login(createUser('token-create'))
      const before = Date.now()
      const created = await createToken(socket, 'Plugin stue')

      expect(created.token.name).toBe('Plugin stue')
      expect(created.token.expiresAt).toBeGreaterThanOrEqual(
        before + 30 * DAY_MS
      )
      expect(created.token.expiresAt).toBeLessThanOrEqual(
        Date.now() + 30 * DAY_MS
      )

      const tokens = await listTokens(socket)
      expect(tokens).toEqual([created.token])
      expect(JSON.stringify(tokens)).not.toContain(created.value)
      expect(created.token.hint).toBe(`…${created.value.slice(-6)}`)
    }
  )

  test.serial('creates a token that never expires', async () => {
    const socket = await login(createUser('token-never'))
    const created = await createToken(socket, 'Forever', null)
    expect(created.token.expiresAt).toBeNull()
    expect(
      (
        await ApiTokenManager.authenticate(
          created.value,
          undefined,
          new Date(Date.now() + 3650 * DAY_MS)
        )
      ).id
    ).toBe(created.token.user)
  })

  test.serial('rejects past expiry dates and blank names', async () => {
    const socket = await login(createUser('token-invalid'))
    await assert.rejects(createToken(socket, 'Past', Date.now() - 1000))
    await assert.rejects(createToken(socket, '   '))
    await assert.rejects(createToken(socket, 'x'.repeat(65)))
  })

  test.serial('rejects a duplicate active name', async () => {
    const socket = await login(createUser('token-duplicate'))
    await createToken(socket, 'Laptop')
    await assert.rejects(createToken(socket, ' Laptop '))
  })

  test.serial('frees a name held by an expired token', async () => {
    const owner = createUser('token-expired-name')
    const past = new Date(Date.now() - 10 * DAY_MS)
    const expired = ApiTokenManager.create(
      owner,
      { name: 'Laptop', expiresAt: past.getTime() + DAY_MS },
      past
    )
    const socket = await login(owner)
    expect((await listTokens(socket)).map(t => t.id)).toEqual([
      expired.token.id,
    ])

    const replacement = await createToken(socket, 'Laptop')
    expect((await listTokens(socket)).map(t => t.id)).toEqual([
      replacement.token.id,
    ])
    await assert.rejects(ApiTokenManager.authenticate(expired.value))
  })
})

describe('token limit', () => {
  test.serial(
    'rejects the eleventh active token for a user and allows it for an admin',
    async () => {
      const socket = await login(createUser('token-limit-user'))
      for (let i = 0; i < MAX_API_TOKENS; i++)
        await createToken(socket, `Token ${i}`)
      await assert.rejects(createToken(socket, 'One too many'))

      const admin = await login(createUser('token-limit-admin', 'admin'))
      for (let i = 0; i <= MAX_API_TOKENS; i++)
        await createToken(admin, `Token ${i}`)
      expect(
        (await listTokens(admin)).filter(t => t.name === 'Token 10')
      ).toHaveLength(1)
    }
  )

  test.serial('does not count revoked or expired tokens', async () => {
    const owner = createUser('token-limit-free')
    const socket = await login(owner)
    const past = new Date(Date.now() - 10 * DAY_MS)
    ApiTokenManager.create(
      owner,
      { name: 'Expired', expiresAt: past.getTime() + DAY_MS },
      past
    )
    const tokens = []
    for (let i = 0; i < MAX_API_TOKENS - 1; i++)
      tokens.push(await createToken(socket, `Token ${i}`))
    const last = await createToken(socket, 'Last')
    assertResponse(await revoke(socket, last.token.id))

    await createToken(socket, 'Replacement')
    await assert.rejects(createToken(socket, 'Over'))
    expect(await listTokens(socket)).toHaveLength(MAX_API_TOKENS + 1)
  })
})

describe('authenticating API tokens', () => {
  let owner: User
  let socket: TypedSocket
  let value: string
  let tokenId: string

  beforeAll(async () => {
    owner = createUser('token-auth')
    socket = await login(owner)
    const created = await createToken(socket, 'Auth')
    value = created.value
    tokenId = created.token.id
  })

  test.serial('accepts a valid token as its owner', async () => {
    const user = await ApiTokenManager.authenticate(value)
    expect(user.id).toBe(owner.id)
    expect(user.passwordHash).toBeUndefined()
    const [token] = await listTokens(socket)
    expect(token.lastUsedAt).not.toBeNull()
  })

  test.serial('rejects tampered, malformed and foreign tokens', async () => {
    const [header, payload, signature] = value.split('.')
    const forged = Buffer.from(
      JSON.stringify({ userId: createUser('token-victim').id, tokenId })
    ).toString('base64url')
    await assert.rejects(
      ApiTokenManager.authenticate(`${header}.${forged}.${signature}`)
    )
    await assert.rejects(
      ApiTokenManager.authenticate(`${header}.${payload}.${signature}x`)
    )
    await assert.rejects(ApiTokenManager.authenticate('not-a-token'))
    await assert.rejects(ApiTokenManager.authenticate(undefined))
    await assert.rejects(
      ApiTokenManager.authenticate(
        jwt.sign({ userId: owner.id, tokenId }, 'another-secret', {
          algorithm: 'HS512',
          noTimestamp: true,
        })
      )
    )
    await assert.rejects(
      ApiTokenManager.authenticate(
        AuthManager.signApiToken(owner.id, randomUUID())
      )
    )
  })

  test.serial('rejects expired tokens', async () => {
    const created = await createToken(socket, 'Short', Date.now() + DAY_MS)
    await assert.rejects(
      ApiTokenManager.authenticate(
        created.value,
        undefined,
        new Date(Date.now() + 2 * DAY_MS)
      )
    )
  })

  test.serial('rejects a session JWT as an API token', async () => {
    await assert.rejects(
      ApiTokenManager.authenticate(AuthManager.sign(owner.id))
    )
  })

  test.serial('rejects an API token as a socket session', async () => {
    const apiSocket = {
      id: 'api-token-socket',
      handshake: { auth: { token: value } },
      data: { token: value, userId: owner.id },
    } as unknown as TypedSocket
    await assert.rejects(AuthManager.checkAuth(apiSocket))
    expect((await AuthManager.refreshToken(apiSocket)).success).toBe(false)
    expect(apiSocket.data.userId).toBe('')
  })

  test.serial('uses the owner current role', async () => {
    const admin = createUser('token-role-admin', 'admin')
    const adminSocket = await login(admin)
    const created = await createToken(adminSocket, 'Admin only')
    expect(
      (await ApiTokenManager.authenticate(created.value, ['admin'])).id
    ).toBe(admin.id)

    db.update(users).set({ role: 'user' }).where(eq(users.id, admin.id)).run()
    await assert.rejects(ApiTokenManager.authenticate(created.value, ['admin']))
  })

  test.serial('rejects revoked tokens', async () => {
    const created = await createToken(socket, 'Revoke me')
    assertResponse(await revoke(socket, created.token.id))
    await assert.rejects(ApiTokenManager.authenticate(created.value))
    expect((await listTokens(socket)).map(t => t.id)).not.toContain(
      created.token.id
    )
  })

  test.serial('rejects tokens of deleted users', async () => {
    db.update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, owner.id))
      .run()
    await assert.rejects(ApiTokenManager.authenticate(value))
  })
})

describe('token ownership', () => {
  test.serial(
    'only the owner or an admin can revoke, and only the owner can reveal',
    async () => {
      const ownerSocket = await login(createUser('token-owner'))
      const otherSocket = await login(createUser('token-other'))
      const adminSocket = await login(createUser('token-owner-admin', 'admin'))
      const created = await createToken(ownerSocket, 'Mine')

      const revealed = await ApiTokenManager.onRevealApiToken(ownerSocket, {
        type: 'ApiTokenRequest',
        id: created.token.id,
      })
      assertResponse(revealed)
      expect(revealed.value).toBe(created.value)

      for (const socket of [otherSocket, adminSocket])
        await assert.rejects(
          ApiTokenManager.onRevealApiToken(socket, {
            type: 'ApiTokenRequest',
            id: created.token.id,
          })
        )

      expect((await listTokens(otherSocket)).map(t => t.id)).not.toContain(
        created.token.id
      )
      expect((await listTokens(adminSocket)).map(t => t.id)).toContain(
        created.token.id
      )

      await assert.rejects(revoke(otherSocket, created.token.id))
      assertResponse(await revoke(adminSocket, created.token.id))
      await assert.rejects(ApiTokenManager.authenticate(created.value))
    }
  )
})

describe('calendar URL', () => {
  test.serial('reuses the calendar token until it is revoked', async () => {
    const socket = await login(createUser('token-calendar'))
    const first = await ApiTokenManager.onGetCalendarUrl(socket)
    assertResponse(first)
    expect(first.created).toBe(true)
    expect(first.path).toStartWith('/api/sessions/calendar.ics?token=')

    const [token] = await listTokens(socket)
    expect(token).toMatchObject({ name: CALENDAR_TOKEN_NAME, expiresAt: null })

    const second = await ApiTokenManager.onGetCalendarUrl(socket)
    assertResponse(second)
    expect(second).toEqual({ ...first, created: false })

    assertResponse(await revoke(socket, token.id))
    const third = await ApiTokenManager.onGetCalendarUrl(socket)
    assertResponse(third)
    expect(third.created).toBe(true)
    expect(third.path).not.toBe(first.path)
  })
})

describe('API token broadcasts', () => {
  test.serial('reach only the owner and admins', async () => {
    function listen(socket: TypedSocket, userId: string) {
      const emit = mock()
      Object.assign(socket, { data: { userId }, emit })
      apiTokenSockets.add(socket)
      return emit
    }
    const owner = createUser('token-broadcast-owner')
    const other = createUser('token-broadcast-other')
    const admin = createUser('token-broadcast-admin', 'admin')
    const ownerSocket = await login(owner)
    const ownerEmit = listen(ownerSocket, owner.id)
    const otherEmit = listen(await login(other), other.id)
    const adminEmit = listen(await login(admin), admin.id)

    try {
      const created = await createToken(ownerSocket, 'Broadcast')
      await Promise.all(pendingApiTokenEmits.splice(0))

      expect(ownerEmit).toHaveBeenCalledWith('api_tokens', [created.token])
      expect(adminEmit).toHaveBeenCalledWith(
        'api_tokens',
        expect.arrayContaining([created.token])
      )
      expect(otherEmit).not.toHaveBeenCalled()
    } finally {
      apiTokenSockets.clear()
    }
  })
})

describe('HTTP endpoints', () => {
  let server: Server
  let origin: string

  beforeAll(async () => {
    const app = express()
    app.use(createWebhookRouter())
    app.use(createCalendarRouter(new URL('http://chugmania.test')))
    server = createServer(app)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    assert(address && typeof address !== 'string')
    origin = `http://127.0.0.1:${address.port}`
  })

  afterAll(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
      )
  )

  function postWebhook(authorization?: string) {
    const event = {
      schemaVersion: '1.0.0',
      type: 'start',
      eventId: randomUUID(),
      sequence: 0,
      occurredAt: new Date().toISOString(),
      durationMs: 0,
      game: { gameId: randomUUID(), totalPlayers: 1 },
      source: {
        pluginName: 'TM Webhooks',
        pluginVersion: '1.0.0',
        game: 'turbo',
      },
      players: [{ playerIndex: 0, name: 'Player' }],
      map: null,
      mode: null,
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      event_type: event.type,
      'event-id': event.eventId,
      'event-sequence': String(event.sequence),
    }
    if (authorization) headers.Authorization = authorization
    return {
      gameId: event.game.gameId,
      response: fetch(`${origin}/api/webhook`, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
      }),
    }
  }

  test.serial(
    'webhook requires a token and records the capture user',
    async () => {
      const admin = await login(createUser('token-webhook-admin', 'admin'))
      const session = await createSession(admin, [])
      assertResponse(
        await SessionManager.onEditSession(admin, {
          type: 'EditSessionRequest',
          id: session.id,
          date: new Date(),
        })
      )
      const owner = createUser('token-webhook-user')
      const { value } = await createToken(await login(owner), 'Plugin')

      const missing = postWebhook()
      expect((await missing.response).status).toBe(401)
      expect(WebhookSource.findCapture(missing.gameId)).toBeUndefined()

      const sessionJwt = postWebhook(`Bearer ${AuthManager.sign(owner.id)}`)
      expect((await sessionJwt.response).status).toBe(401)

      const accepted = postWebhook(`Bearer ${value}`)
      expect((await accepted.response).status).toBe(204)
      expect(WebhookSource.findCapture(accepted.gameId)?.user).toBe(owner.id)
    }
  )

  test.serial('calendar feed requires a token', async () => {
    const socket = await login(createUser('token-calendar-feed'))
    const unauthorized = await fetch(`${origin}/api/sessions/calendar.ics`)
    expect(unauthorized.status).toBe(401)
    expect(await unauthorized.json()).toMatchObject({ code: 'UNAUTHORIZED' })

    const calendar = await ApiTokenManager.onGetCalendarUrl(socket)
    assertResponse(calendar)
    const response = await fetch(`${origin}${calendar.path}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/calendar')
    expect(await response.text()).toContain('BEGIN:VCALENDAR')
  })
})
