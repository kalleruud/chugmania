import { expect, test } from 'bun:test'
import express from 'express'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { createWebhookRouter } from '../backend/src/endpoints/webhook'
import AdminManager from '../backend/src/managers/admin.manager'
import MatchManager from '../backend/src/managers/match.manager'
import RatingManager from '../backend/src/managers/rating.manager'
import SessionManager from '../backend/src/managers/session.manager'
import TimeEntryManager from '../backend/src/managers/timeEntry.manager'
import TrackManager from '../backend/src/managers/track.manager'
import UserManager from '../backend/src/managers/user.manager'
import WebhookManager from '../backend/src/managers/webhook.manager'
import type {
  Event,
  Map,
  Source,
} from '../backend/src/models/webhook.generated'
import { broadcast, type TypedSocket } from '../backend/src/server'
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
    source: {
      pluginName: 'TM Webhooks',
      pluginVersion: '1.0.0',
      game,
    } satisfies Source,
  }
  const player = (playerIndex: number) => ({
    playerIndex,
    name: `Private ${playerIndex}`,
  })
  const send = (event: Event) => {
    WebhookManager.receive(event, JSON.stringify(event), now)
  }
  return {
    start: (map: Map | null = null) =>
      send({
        ...base,
        eventId: randomUUID(),
        type: 'start',
        sequence: 0,
        durationMs: 0,
        players: Array.from({ length: totalPlayers }, (_, i) => player(i)),
        map,
        mode: null,
      }),
    finish: (sequence: number, playerIndex: number, durationMs: number) =>
      send({
        ...base,
        eventId: randomUUID(),
        type: 'finish',
        sequence,
        durationMs,
        player: player(playerIndex),
        checkpoint: { checkpointIndex: 2, checkpointLapIndex: 2, lapNumber: 1 },
      }),
    throttle: (sequence: number, playerIndex: number, durationMs: number) =>
      send({
        ...base,
        eventId: randomUUID(),
        type: 'first_throttle',
        sequence,
        durationMs,
        player: player(playerIndex),
      }),
    end: (sequence: number) =>
      send({
        ...base,
        eventId: randomUUID(),
        type: 'end',
        sequence,
        durationMs: 20000,
        endReason: 'completed',
      }),
  }
}

test('webhook entries use normal feeds, status updates and millisecond times', async () => {
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
  expect(broadcast).toHaveBeenCalledWith(
    'all_time_entries',
    await TimeEntryManager.getAllTimeEntries()
  )
})

test('normal updates support DNF and reject edits to deleted webhook entries', async () => {
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
})

test('webhook matches create tracks by uid and complete through normal match edits', async () => {
  const admin = await login(createUser('match-entry-admin', 'admin'))
  const first = createUser('match-entry-first')
  const second = createUser('match-entry-second')
  const outsider = await login(createUser('match-entry-outsider'))
  const moderator = await login(
    createUser('match-entry-moderator', 'moderator')
  )
  const participant = await login(first)
  const { onEditMatch } = MatchManager
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
    medalTimesMs: { author: 10000, gold: 12000, silver: 14000, bronze: 16000 },
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
    onEditMatch(outsider, {
      type: 'EditMatchRequest',
      id: match.id,
      status: 'completed',
    })
  )
  assertResponse(
    await onEditMatch(admin, {
      type: 'EditMatchRequest',
      id: match.id,
      user1: first.id,
      user2: second.id,
      status: 'draft',
    })
  )
  expect(RatingManager.getUserRatings(first.id)).toBeUndefined()
  expect(RatingManager.getUserRatings(second.id)).toBeUndefined()
  await assert.rejects(
    onEditMatch(participant, {
      type: 'EditMatchRequest',
      id: match.id,
      status: 'completed',
    })
  )
  assertResponse(
    await onEditMatch(moderator, {
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
  expect(RatingManager.getUserRatings(first.id)).toBeDefined()
  expect(RatingManager.getUserRatings(second.id)).toBeDefined()
  const repeated = capture(now, 1, 'next')
  repeated.start(map)
  expect(
    (await TrackManager.getAllTracks()).filter(track => track.uid === map.uid)
  ).toHaveLength(1)
  const exported = await AdminManager.onExportCsv(admin, {
    table: 'webhookEvents',
  })
  assertResponse(exported)
  expect(exported.csv).toContain('rawPayload')
  const imported = await AdminManager.onImportCsv(admin, {
    table: 'webhookEvents',
    content: exported.csv,
  })
  assertResponse(imported)
})

test('webhook HTTP rejects unsupported counts and invalid rosters without persistence', async () => {
  const admin = await login(createUser('webhook-validation-admin', 'admin'))
  await startedSession(admin, new Date())
  const app = express()
  app.use(createWebhookRouter())
  const server = createServer(app)
  const previousToken = process.env.WEBHOOK_TOKEN
  process.env.WEBHOOK_TOKEN = 'webhook-validation-token'
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    assert(address && typeof address !== 'string')
    const endpoint = `http://127.0.0.1:${address.port}/api/webhook`
    capture(new Date(), 1, 'turbo').start()
    const beforeCaptures = await AdminManager.onExportCsv(admin, {
      table: 'webhookCaptures',
    })
    const beforeEvents = await AdminManager.onExportCsv(admin, {
      table: 'webhookEvents',
    })
    assertResponse(beforeCaptures)
    assertResponse(beforeEvents)
    for (const scenario of [
      {
        totalPlayers: 3,
        players: [{ playerIndex: 0 }, { playerIndex: 1 }, { playerIndex: 2 }],
        code: 'UNSUPPORTED_PLAYER_COUNT',
      },
      { totalPlayers: 1, players: [], code: 'INVALID_ROSTER' },
      {
        totalPlayers: 2,
        players: [{ playerIndex: 0 }, { playerIndex: 0 }],
        code: 'INVALID_ROSTER',
      },
    ]) {
      const event = {
        schemaVersion: '1.0.0',
        type: 'start',
        eventId: randomUUID(),
        sequence: 0,
        occurredAt: new Date().toISOString(),
        durationMs: 0,
        game: { gameId: randomUUID(), totalPlayers: scenario.totalPlayers },
        source: {
          pluginName: 'TM Webhooks',
          pluginVersion: '1.0.0',
          game: 'turbo',
        },
        players: scenario.players,
        map: null,
        mode: null,
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer webhook-validation-token',
          'Content-Type': 'application/json',
          event_type: event.type,
          'event-id': event.eventId,
          'event-sequence': String(event.sequence),
        },
        body: JSON.stringify(event),
      })
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: scenario.code })
    }
    const afterCaptures = await AdminManager.onExportCsv(admin, {
      table: 'webhookCaptures',
    })
    const afterEvents = await AdminManager.onExportCsv(admin, {
      table: 'webhookEvents',
    })
    assertResponse(afterCaptures)
    assertResponse(afterEvents)
    expect(afterCaptures.csv).toBe(beforeCaptures.csv)
    expect(afterEvents.csv).toBe(beforeEvents.csv)
  } finally {
    if (previousToken === undefined) delete process.env.WEBHOOK_TOKEN
    else process.env.WEBHOOK_TOKEN = previousToken
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    )
  }
})

test('track CSV round trips preserve webhook UIDs and metadata', async () => {
  const admin = await login(createUser('track-csv-admin', 'admin'))
  assertResponse(
    await AdminManager.onImportCsv(admin, {
      table: 'tracks',
      content:
        'id,game,name,uid,level,author\ntrack-csv-map,turbo,CSV map,track-csv-uid,custom,Mapper',
    })
  )
  const before = await TrackManager.getAllTracks()
  const exported = await AdminManager.onExportCsv(admin, { table: 'tracks' })
  assertResponse(exported)
  assertResponse(
    await AdminManager.onImportCsv(admin, {
      table: 'tracks',
      content: exported.csv,
    })
  )
  const after = await TrackManager.getAllTracks()
  expect(after).toHaveLength(before.length)
  for (const track of before) {
    const { updatedAt, ...expected } = track
    expect(after.find(row => row.id === track.id)).toMatchObject(expected)
  }
})
