import { expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import TrackSource from '../backend/database/track.source'
import AdminManager from '../backend/src/managers/admin.manager'
import MatchManager from '../backend/src/managers/match.manager'
import RatingManager from '../backend/src/managers/rating.manager'
import SessionManager from '../backend/src/managers/session.manager'
import TimeEntryManager from '../backend/src/managers/timeEntry.manager'
import UserManager from '../backend/src/managers/user.manager'
import WebhookManager from '../backend/src/managers/webhook.manager'
import { isWebhookEvent } from '../backend/src/models/webhook'
import type { Map, Source } from '../backend/src/models/webhook.generated'
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
    source: { pluginName: 'TM Webhooks', pluginVersion: '1.0.0', game },
  }
  const player = (playerIndex: number) => ({
    playerIndex,
    name: `Private ${playerIndex}`,
  })
  const send = (data: Record<string, unknown>) => {
    const event = { ...base, eventId: randomUUID(), ...data }
    assert(isWebhookEvent(event))
    WebhookManager.receive(event, JSON.stringify(event), now)
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
  const track = (await TrackSource.getAll()).find(
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
  expect(RatingManager.getUserRatings(first.id)).toBeUndefined()
  expect(RatingManager.getUserRatings(second.id)).toBeUndefined()
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
  expect(RatingManager.getUserRatings(first.id)).toBeDefined()
  const repeated = capture(now, 1, 'next')
  repeated.start(map)
  expect(
    (await TrackSource.getAll()).filter(track => track.uid === map.uid)
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
