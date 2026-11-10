import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import express from 'express'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import WebhookSource from '../backend/database/sources/webhook.source'
import { createWebhookRouter } from '../backend/src/endpoints/webhook'
import MatchManager from '../backend/src/managers/match.manager'
import SessionManager from '../backend/src/managers/session.manager'
import TimeEntryManager from '../backend/src/managers/timeEntry.manager'
import WebhookManager, {
  WebhookError,
} from '../backend/src/managers/webhook.manager'
import { isWebhookEvent } from '../backend/src/models/webhook'
import type {
  Event,
  Map,
  StartEvent,
} from '../backend/src/models/webhook.generated'
import { broadcast } from '../backend/src/server'
import { assertResponse, createSession, createUser, login } from './utils'

const now = new Date('2031-06-10T12:00:00.000Z')
const map: Map = {
  uid: 'validated-webhook-map',
  name: 'Validated map',
  author: 'Mapper',
  environment: 'Stadium',
  type: 'Race',
  medalTimesMs: { author: 10000, gold: 12000, silver: 14000, bronze: 16000 },
  isLaps: false,
  checkpointsPerLap: 1,
}

function startEvent(): StartEvent {
  return {
    schemaVersion: '1.0.0',
    type: 'start',
    eventId: randomUUID(),
    sequence: 0,
    occurredAt: now.toISOString(),
    durationMs: 0,
    game: { gameId: randomUUID(), totalPlayers: 1 },
    source: { pluginName: 'TM Webhooks', pluginVersion: '1.0.0', game: 'next' },
    players: [{ playerIndex: 0, name: 'Webhook regression player' }],
    map: null,
    mode: null,
  }
}

function playerEvent(
  start: StartEvent,
  type: 'finish' | 'first_throttle',
  sequence: number,
  durationMs: number
): Event {
  const base = {
    ...start,
    eventId: randomUUID(),
    sequence,
    durationMs,
    player: start.players[0],
  }
  if (type === 'first_throttle') return { ...base, type }
  return {
    ...base,
    type,
    checkpoint: { checkpointIndex: 2, checkpointLapIndex: 2, lapNumber: 1 },
  }
}

function receive(event: Event): string {
  const result = WebhookManager.receive(event, JSON.stringify(event), now)
  assert.equal(result.error, null)
  assert(result.data)
  return result.data
}

beforeAll(async () => {
  const admin = await login(createUser('webhook-regression-admin', 'admin'))
  const session = await createSession(admin, [])
  assertResponse(
    await SessionManager.onEditSession(admin, {
      type: 'EditSessionRequest',
      id: session.id,
      date: now,
    })
  )
})

describe('webhook replay', () => {
  test.serial(
    'identical retries ignore nested JSON property order and retain one event',
    () => {
      const start = startEvent()
      receive(start)
      const reordered = {
        ...Object.fromEntries(Object.entries(start).reverse()),
        source: Object.fromEntries(Object.entries(start.source).reverse()),
        game: Object.fromEntries(Object.entries(start.game).reverse()),
        players: start.players.map(player =>
          Object.fromEntries(Object.entries(player).reverse())
        ),
      }
      assert(isWebhookEvent(reordered))
      expect(
        WebhookManager.receive(reordered, JSON.stringify(reordered), now)
      ).toEqual({ data: 'Duplicate ignored', error: null })
      const changed = {
        ...start,
        players: [{ ...start.players[0], name: 'Changed player' }],
      }
      const result = WebhookManager.receive(
        changed,
        JSON.stringify(changed),
        now
      )
      assert(result.error instanceof WebhookError)
      expect(result.error.code).toBe('EVENT_CONFLICT')
      expect(WebhookSource.getEvents(start.game.gameId)).toHaveLength(1)
    }
  )

  test.serial(
    'out-of-order delivery derives earliest throttle and excludes events after end',
    async () => {
      const start = startEvent()
      const finish = playerEvent(start, 'finish', 4, 12000)
      receive(finish)
      receive(playerEvent(start, 'first_throttle', 3, 2000))
      receive(playerEvent(start, 'first_throttle', 1, 1000))
      receive({
        ...start,
        eventId: randomUUID(),
        type: 'end',
        sequence: 5,
        durationMs: 12000,
        endReason: 'completed',
      })
      receive(playerEvent(start, 'finish', 6, 9000))
      receive(start)
      expect(
        (await TimeEntryManager.getAllTimeEntries()).find(
          entry => entry.webhookCapture === start.game.gameId
        )
      ).toMatchObject({
        status: 'draft',
        duration: 12000,
        chugDurationMs: 1000,
      })
    }
  )

  test.serial(
    'conflicting roster and sequence return errors without persisting rejected events',
    () => {
      const start = startEvent()
      receive(start)
      const conflictingPlayer = {
        ...playerEvent(start, 'first_throttle', 1, 1000),
        player: { playerIndex: 0, name: 'Wrong player' },
      }
      const rosterResult = WebhookManager.receive(
        conflictingPlayer,
        JSON.stringify(conflictingPlayer),
        now
      )
      assert(rosterResult.error instanceof WebhookError)
      expect(rosterResult.error.code).toBe('PLAYER_CONFLICT')
      expect(WebhookSource.getEvents(start.game.gameId)).toHaveLength(1)
      receive(playerEvent(start, 'first_throttle', 1, 1000))
      const conflictingSequence = playerEvent(start, 'finish', 1, 10000)
      const sequenceResult = WebhookManager.receive(
        conflictingSequence,
        JSON.stringify(conflictingSequence),
        now
      )
      assert(sequenceResult.error instanceof WebhookError)
      expect(sequenceResult.error.code).toBe('SEQUENCE_CONFLICT')
      expect(WebhookSource.getEvents(start.game.gameId)).toHaveLength(2)
    }
  )

  test.serial(
    'a failed feed is logged while other feeds publish and persistence remains successful',
    async () => {
      const failure = new Error('Time entry feed unavailable')
      const entries = spyOn(
        TimeEntryManager,
        'getAllTimeEntries'
      ).mockRejectedValueOnce(failure)
      const errors = spyOn(console, 'error').mockImplementation(() => {})
      try {
        const start = { ...startEvent(), map }
        expect(receive(start)).toBe('Stored')
        const matchRows = await MatchManager.getAllMatches()
        await Promise.resolve()
        expect(errors).toHaveBeenCalledWith(
          'Webhook publication failed',
          { captureId: start.game.gameId, feed: 'all_time_entries' },
          failure
        )
        expect(broadcast).toHaveBeenCalledWith('all_matches', matchRows)
        expect(WebhookSource.getEvents(start.game.gameId)).toHaveLength(1)
      } finally {
        entries.mockRestore()
        errors.mockRestore()
      }
    }
  )
})

describe('webhook HTTP validation', () => {
  const server = createServer(express().use(createWebhookRouter()))
  const originalToken = process.env.WEBHOOK_TOKEN
  let url: string

  beforeAll(async () => {
    process.env.WEBHOOK_TOKEN = 'webhook-test-token'
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    assert(address && typeof address === 'object')
    url = `http://127.0.0.1:${address.port}/api/webhook`
  })

  afterAll(async () => {
    if (originalToken === undefined) delete process.env.WEBHOOK_TOKEN
    else process.env.WEBHOOK_TOKEN = originalToken
    if (!server.listening) return
    const closed = once(server, 'close')
    server.close()
    server.closeAllConnections()
    await closed
  })

  function post(
    body: unknown,
    event: Event,
    headers: Record<string, string> = {}
  ) {
    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer webhook-test-token',
        'Content-Type': 'application/json',
        event_type: event.type,
        'event-id': event.eventId,
        'event-sequence': String(event.sequence),
        ...headers,
      },
      body: JSON.stringify(body),
    })
  }

  test.serial(
    'malformed nested data is rejected before persistence',
    async () => {
      const start = startEvent()
      const finish = playerEvent(start, 'finish', 1, 10000)
      const invalidBodies: unknown[] = [
        { ...start, players: undefined },
        { ...start, players: [] },
        { ...start, players: [{ playerIndex: 1 }] },
        { ...start, players: [{ playerIndex: 0, name: 123 }] },
        { ...start, game: { ...start.game, totalPlayers: 3 } },
        { ...start, source: {} },
        { ...start, source: { ...start.source, game: 'unsupported' } },
        { ...start, map: { ...map, medalTimesMs: undefined } },
        { ...start, map: { ...map, totalLaps: 0 } },
        { ...start, mode: { name: 'unsupported' } },
        { ...start, mode: { name: 'solo', type: 'unsupported' } },
        { ...start, occurredAt: 'invalid-date' },
        { ...start, sequence: -1 },
        { ...start, sequence: 0.5 },
        { ...start, durationMs: -1 },
        { ...finish, player: undefined },
        { ...finish, checkpoint: undefined },
        {
          ...finish,
          checkpoint: {
            checkpointIndex: 2,
            checkpointLapIndex: 2,
            lapNumber: 0,
          },
        },
        { ...start, type: 'end', endReason: 'unsupported' },
      ]
      for (const body of invalidBodies) {
        const response = await post(body, start)
        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({ code: 'INVALID_EVENT' })
      }
      expect(WebhookSource.findCapture(start.game.gameId)).toBeUndefined()
    }
  )

  test.serial('accepts valid event variants and maps', async () => {
    const start = {
      ...startEvent(),
      occurredAt: new Date().toISOString(),
      map,
      mode: { name: 'solo', type: 'time-attack' },
    }
    assert(isWebhookEvent(start))
    const admin = await login(createUser('webhook-http-admin', 'admin'))
    const session = await createSession(admin, [])
    assertResponse(
      await SessionManager.onEditSession(admin, {
        type: 'EditSessionRequest',
        id: session.id,
        date: new Date(Date.now() - 1000),
      })
    )
    const response = await post(start, start)
    expect(response.status).toBe(204)
    for (const type of ['checkpoint', 'lap', 'respawn', 'finish']) {
      const event: unknown = {
        ...playerEvent(
          start,
          'finish',
          WebhookSource.getEvents(start.game.gameId).length,
          10000
        ),
        type,
      }
      assert(isWebhookEvent(event))
      expect((await post(event, event)).status).toBe(204)
    }
    const end = {
      ...start,
      type: 'end',
      eventId: randomUUID(),
      sequence: 5,
      endReason: 'completed',
    }
    assert(isWebhookEvent(end))
    expect((await post(end, end)).status).toBe(204)
  })

  test.serial(
    'authentication, mismatched headers and invalid JSON retain their error responses',
    async () => {
      const start = startEvent()
      expect(
        (await post(start, start, { Authorization: 'Bearer wrong' })).status
      ).toBe(401)
      const mismatch = await post(start, start, { 'event-id': randomUUID() })
      expect(mismatch.status).toBe(400)
      expect(await mismatch.json()).toMatchObject({ code: 'HEADER_MISMATCH' })
      const invalidJson = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer webhook-test-token',
          'Content-Type': 'application/json',
        },
        body: '{',
      })
      expect(invalidJson.status).toBe(400)
      expect(await invalidJson.json()).toMatchObject({ code: 'INVALID_JSON' })
    }
  )

  test.serial(
    'unexpected persistence errors are logged with the event ID and returned as generic 500s',
    async () => {
      const start = startEvent()
      const failure = new Error('Database unavailable')
      const findEvent = spyOn(
        WebhookSource,
        'findEvent'
      ).mockImplementationOnce(() => {
        throw failure
      })
      const errors = spyOn(console, 'error').mockImplementation(() => {})
      try {
        const response = await post(start, start)
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          code: 'RECEIVER_ERROR',
          message: 'Could not persist webhook event',
        })
        expect(errors).toHaveBeenCalledWith(
          'Webhook receiver failed',
          { eventId: start.eventId, eventType: start.type },
          failure
        )
      } finally {
        findEvent.mockRestore()
        errors.mockRestore()
      }
    }
  )
})
