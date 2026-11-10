import { beforeAll, describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { receiveWebhookEvent } from '../backend/src/endpoints/webhook'
import MatchManager from '../backend/src/managers/match.manager'
import RatingManager from '../backend/src/managers/rating.manager'
import SessionManager from '../backend/src/managers/session.manager'
import TimeEntryManager from '../backend/src/managers/timeEntry.manager'
import TrackManager from '../backend/src/managers/track.manager'
import UserManager from '../backend/src/managers/user.manager'
import type { Map, Source } from '../backend/src/models/webhook.generated'
import { type TypedSocket } from '../backend/src/server'
import { assertResponse, createSession, createUser, login } from './utils'

async function startedSession(socket: TypedSocket, date: Date) {
  const session = await createSession(socket, [])
  assertResponse(
    await SessionManager.onEditSession(socket, {
      type: 'EditSessionRequest',
      id: session.id,
      date,
    })
  )
  return session.id
}

function capture(now: Date, totalPlayers: number, game: Source['game']) {
  const base = {
    schemaVersion: '1.0.0',
    occurredAt: now.toISOString(),
    game: { gameId: randomUUID(), totalPlayers },
    source: { pluginName: 'TM Webhooks', pluginVersion: '1.0.0', game },
  }
  const player = (playerIndex: number) => ({
    playerIndex,
    name: `Private ${playerIndex}`,
  })
  const send = (data: Record<string, unknown>) => {
    const event = { ...base, eventId: randomUUID(), ...data }
    const result = receiveWebhookEvent(
      JSON.stringify(event),
      {
        eventType: String(data.type),
        eventId: event.eventId,
        eventSequence: String(data.sequence),
      },
      now
    )
    assert.equal(result.error, null)
  }
  return {
    start: (map: Map | null = null) =>
      send({
        type: 'start',
        sequence: 0,
        durationMs: 0,
        players: Array.from({ length: totalPlayers }, (_, i) => player(i)),
        map,
        mode: null,
      }),
    finish: (sequence: number, playerIndex: number, durationMs: number) =>
      send({
        type: 'finish',
        sequence,
        durationMs,
        player: player(playerIndex),
        checkpoint: { checkpointIndex: 2, checkpointLapIndex: 2, lapNumber: 1 },
      }),
    throttle: (sequence: number, playerIndex: number, durationMs: number) =>
      send({
        type: 'first_throttle',
        sequence,
        durationMs,
        player: player(playerIndex),
      }),
    end: (sequence: number) =>
      send({
        type: 'end',
        sequence,
        durationMs: 20000,
        endReason: 'completed',
      }),
  }
}

test.serial(
  'webhook entries use normal feeds, status updates and millisecond times',
  async () => {
    const participant = createUser('entry-lifecycle')
    const socket = await login(participant)
    const now = new Date('2030-01-14T12:00:00.000Z')
    const admin = await login(createUser('entry-lifecycle-admin', 'admin'))
    const session = await startedSession(admin, now)
    const game = capture(now, 1, 'turbo')
    game.start()
    const entry = (await TimeEntryManager.getAllTimeEntries()).find(
      row => row.session === session
    )
    assert(entry)
    expect(entry).toMatchObject({
      status: 'in_progress',
      user: null,
      track: null,
    })
    expect(entry).not.toHaveProperty('publicationState')
    game.finish(1, 0, 12347)
    expect(
      (await TimeEntryManager.getAllTimeEntries()).find(
        row => row.id === entry.id
      )
    ).toMatchObject({
      status: 'draft',
      duration: 12347,
    })
    assertResponse(
      await TimeEntryManager.onEditTimeEntry(socket, {
        type: 'EditTimeEntryRequest',
        id: entry.id,
        user: participant.id,
        status: 'draft',
        duration: 12349,
      })
    )
    game.throttle(2, 0, 1023)
    game.finish(3, 0, 11001)
    game.end(4)
    expect(
      (await TimeEntryManager.getAllTimeEntries()).find(
        row => row.id === entry.id
      )
    ).toMatchObject({
      duration: 12349,
      chugDurationMs: 1023,
      status: 'draft',
    })
    assertResponse(
      await TimeEntryManager.onEditTimeEntry(socket, {
        type: 'EditTimeEntryRequest',
        id: entry.id,
        status: 'completed',
      })
    )
    expect(
      (await TimeEntryManager.getAllTimeEntries()).find(
        row => row.id === entry.id
      )
    ).toMatchObject({
      user: participant.id,
      track: null,
      status: 'completed',
    })
  }
)

test.serial(
  'normal updates support DNF and reject edits to deleted webhook entries',
  async () => {
    const admin = await login(createUser('dnf-admin', 'admin'))
    const participant = createUser('dnf-user')
    const socket = await login(participant)
    const now = new Date('2030-01-15T12:00:00.000Z')
    const session = await startedSession(admin, now)
    const game = capture(now, 1, 'turbo')
    game.start()
    game.end(1)
    const entry = (await TimeEntryManager.getAllTimeEntries()).find(
      row => row.session === session
    )
    assert(entry)
    assertResponse(
      await TimeEntryManager.onEditTimeEntry(socket, {
        type: 'EditTimeEntryRequest',
        id: entry.id,
        user: participant.id,
        status: 'completed',
        duration: null,
      })
    )
    expect(
      (await TimeEntryManager.getAllTimeEntries()).find(
        row => row.id === entry.id
      )
    ).toMatchObject({ status: 'completed', duration: null })
    assertResponse(
      await TimeEntryManager.onEditTimeEntry(socket, {
        type: 'EditTimeEntryRequest',
        id: entry.id,
        status: 'draft',
      })
    )
    assertResponse(
      await UserManager.onDeleteUser(admin, {
        type: 'DeleteUserRequest',
        id: participant.id,
      })
    )
    await assert.rejects(
      TimeEntryManager.onEditTimeEntry(admin, {
        type: 'EditTimeEntryRequest',
        id: entry.id,
        status: 'completed',
      })
    )
  }
)

test.serial(
  'webhook matches create tracks by uid and complete through normal match edits',
  async () => {
    const admin = await login(createUser('match-entry-admin', 'admin'))
    const first = createUser('match-entry-first')
    const second = createUser('match-entry-second')
    const outsider = await login(createUser('match-entry-outsider'))
    const now = new Date('2030-01-16T12:00:00.000Z')
    const session = await startedSession(admin, now)
    const map: Map = {
      uid: 'normal-feed-map',
      name: 'New map',
      author: 'Mapper',
      environment: 'Stadium',
      type: 'Race',
      isLaps: false,
      checkpointsPerLap: 2,
      medalTimesMs: {
        author: 10000,
        gold: 12000,
        silver: 14000,
        bronze: 16000,
      },
    }
    const game = capture(now, 2, 'next')
    game.start(map)
    const match = (await MatchManager.getAllMatches()).find(
      row => row.session === session
    )
    assert(match)
    const track = (await TrackManager.getAllTracks()).find(
      track => track.uid === map.uid
    )
    assert(track)
    expect(match).toMatchObject({ status: 'in_progress', track: track.id })
    game.finish(1, 0, 10001)
    game.finish(2, 1, 12003)
    game.end(3)
    await assert.rejects(
      MatchManager.onEditMatch(outsider, {
        type: 'EditMatchRequest',
        id: match.id,
        status: 'completed',
      })
    )
    assertResponse(
      await MatchManager.onEditMatch(admin, {
        type: 'EditMatchRequest',
        id: match.id,
        user1: first.id,
        user2: second.id,
        status: 'draft',
      })
    )
    expect(
      RatingManager.onGetRatings().find(ranking => ranking.user === first.id)
    ).toBeUndefined()
    expect(
      RatingManager.onGetRatings().find(ranking => ranking.user === second.id)
    ).toBeUndefined()
    assertResponse(
      await MatchManager.onEditMatch(admin, {
        type: 'EditMatchRequest',
        id: match.id,
        user1: first.id,
        user2: second.id,
        status: 'completed',
      })
    )
    expect(
      (await MatchManager.getAllMatches()).find(row => row.id === match.id)
    ).toMatchObject({
      winner: first.id,
      duration: 10001,
      status: 'completed',
    })
    expect(
      RatingManager.onGetRatings().find(ranking => ranking.user === first.id)
    ).toBeDefined()
    const repeated = capture(now, 1, 'next')
    repeated.start(map)
    expect(
      (await TrackManager.getAllTracks()).filter(track => track.uid === map.uid)
    ).toHaveLength(1)
  }
)

describe('webhook delivery', () => {
  const now = new Date('2031-06-10T12:00:00.000Z')

  beforeAll(async () => {
    const admin = await login(createUser('webhook-delivery-admin', 'admin'))
    await startedSession(admin, now)
  })

  function startEvent() {
    return {
      schemaVersion: '1.0.0',
      type: 'start',
      eventId: randomUUID(),
      sequence: 0,
      occurredAt: now.toISOString(),
      durationMs: 0,
      game: { gameId: randomUUID(), totalPlayers: 1 },
      source: {
        pluginName: 'TM Webhooks',
        pluginVersion: '1.0.0',
        game: 'next',
      },
      players: [{ playerIndex: 0, name: 'Delivery player' }],
      map: null,
      mode: null,
    }
  }

  function send(body: Record<string, unknown>) {
    return receiveWebhookEvent(
      JSON.stringify(body),
      {
        eventType: String(body.type),
        eventId: String(body.eventId),
        eventSequence: String(body.sequence),
      },
      now
    )
  }

  async function entries(gameId: string) {
    return (await TimeEntryManager.getAllTimeEntries()).filter(
      entry => entry.webhookCapture === gameId
    )
  }

  test.serial(
    'retries accept reordered JSON and reject changed payloads without duplicating entries',
    async () => {
      const start = startEvent()
      expect(send(start).error).toBeNull()
      const before = await entries(start.game.gameId)
      expect(before).toHaveLength(1)
      const reordered = {
        ...Object.fromEntries(Object.entries(start).reverse()),
        source: Object.fromEntries(Object.entries(start.source).reverse()),
        game: Object.fromEntries(Object.entries(start.game).reverse()),
        players: start.players.map(player =>
          Object.fromEntries(Object.entries(player).reverse())
        ),
      }
      expect(send(reordered).error).toBeNull()
      expect(
        send({ ...start, players: [{ playerIndex: 0, name: 'Changed' }] }).error
      ).toMatchObject({ status: 409, code: 'EVENT_CONFLICT' })
      expect(await entries(start.game.gameId)).toEqual(before)
    }
  )

  test.serial(
    'out-of-order delivery uses earliest throttle and excludes finishes after end',
    async () => {
      const start = startEvent()
      const playerEvent = {
        ...start,
        player: start.players[0],
        checkpoint: { checkpointIndex: 2, checkpointLapIndex: 2, lapNumber: 1 },
      }
      const events = [
        {
          ...playerEvent,
          eventId: randomUUID(),
          type: 'finish',
          sequence: 4,
          durationMs: 12000,
        },
        {
          ...playerEvent,
          eventId: randomUUID(),
          type: 'first_throttle',
          sequence: 3,
          durationMs: 2000,
        },
        {
          ...playerEvent,
          eventId: randomUUID(),
          type: 'first_throttle',
          sequence: 1,
          durationMs: 1000,
        },
        {
          ...start,
          eventId: randomUUID(),
          type: 'end',
          sequence: 5,
          durationMs: 12000,
          endReason: 'completed',
        },
        {
          ...playerEvent,
          eventId: randomUUID(),
          type: 'finish',
          sequence: 6,
          durationMs: 9000,
        },
        start,
      ]
      for (const event of events) expect(send(event).error).toBeNull()
      expect(await entries(start.game.gameId)).toMatchObject([
        { status: 'draft', duration: 12000, chugDurationMs: 1000 },
      ])
    }
  )

  test.serial(
    'roster and sequence conflicts leave visible times unchanged and allow a valid retry',
    async () => {
      const start = startEvent()
      expect(send(start).error).toBeNull()
      const throttle = {
        ...start,
        eventId: randomUUID(),
        type: 'first_throttle',
        sequence: 1,
        durationMs: 1000,
        player: start.players[0],
      }
      expect(
        send({ ...throttle, player: { playerIndex: 0, name: 'Wrong player' } })
          .error
      ).toMatchObject({ status: 409, code: 'PLAYER_CONFLICT' })
      expect(await entries(start.game.gameId)).toMatchObject([
        { status: 'in_progress', duration: null, chugDurationMs: null },
      ])
      expect(send(throttle).error).toBeNull()
      const finish = {
        ...throttle,
        eventId: randomUUID(),
        type: 'finish',
        durationMs: 12000,
        checkpoint: { checkpointIndex: 2, checkpointLapIndex: 2, lapNumber: 1 },
      }
      expect(send(finish).error).toMatchObject({
        status: 409,
        code: 'SEQUENCE_CONFLICT',
      })
      expect(await entries(start.game.gameId)).toMatchObject([
        { status: 'in_progress', duration: null, chugDurationMs: 1000 },
      ])
      expect(send({ ...finish, sequence: 2 }).error).toBeNull()
      expect(await entries(start.game.gameId)).toMatchObject([
        { status: 'draft', duration: 12000 },
      ])
    }
  )

  test.serial(
    'malformed payloads create no entries and do not block a valid retry',
    async () => {
      const start = startEvent()
      const invalid = [
        { ...start, players: undefined },
        { ...start, players: [] },
        { ...start, players: [{ playerIndex: 1 }] },
        { ...start, players: [{ playerIndex: 0, name: 123 }] },
        { ...start, game: { ...start.game, totalPlayers: 3 } },
        { ...start, source: {} },
        { ...start, map: { uid: 'incomplete' } },
        { ...start, mode: { name: 'unsupported' } },
        { ...start, occurredAt: 'invalid-date' },
        { ...start, sequence: -1 },
        { ...start, sequence: 0.5 },
        { ...start, durationMs: -1 },
        { ...start, type: 'finish', player: undefined, checkpoint: undefined },
        { ...start, type: 'end', endReason: 'unsupported' },
      ]
      const before = await TimeEntryManager.getAllTimeEntries()
      for (const body of invalid)
        expect(send(body).error).toMatchObject({
          status: 400,
          code: 'INVALID_EVENT',
        })
      expect(await TimeEntryManager.getAllTimeEntries()).toEqual(before)
      expect(send(start).error).toBeNull()
      expect(await entries(start.game.gameId)).toMatchObject([
        { status: 'in_progress', duration: null },
      ])
    }
  )

  test.serial(
    'invalid JSON and mismatched headers create no entries',
    async () => {
      const start = startEvent()
      const headers = {
        eventType: start.type,
        eventId: start.eventId,
        eventSequence: String(start.sequence),
      }
      expect(receiveWebhookEvent('{', headers, now).error).toMatchObject({
        status: 400,
        code: 'INVALID_JSON',
      })
      expect(
        receiveWebhookEvent(
          JSON.stringify(start),
          { ...headers, eventId: randomUUID() },
          now
        ).error
      ).toMatchObject({ status: 400, code: 'HEADER_MISMATCH' })
      expect(await entries(start.game.gameId)).toEqual([])
    }
  )
})
