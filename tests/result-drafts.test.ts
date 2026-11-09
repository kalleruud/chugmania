import { expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import db from '../backend/database/database'
import { timeEntries, tracks } from '../backend/database/schema'
import AdminManager from '../backend/src/managers/admin.manager'
import MatchManager from '../backend/src/managers/match.manager'
import SessionManager from '../backend/src/managers/session.manager'
import TimeEntryManager from '../backend/src/managers/timeEntry.manager'
import UserManager from '../backend/src/managers/user.manager'
import WebhookManager from '../backend/src/managers/webhook.manager'
import { isWebhookEvent } from '../backend/src/models/webhook'
import type { Map, Source } from '../backend/src/models/webhook.generated'
import { broadcast, type TypedSocket } from '../backend/src/server'
import type { ResultDraftRequest } from '../common/models/resultDraft'
import {
  assertResponse,
  createSession,
  createTracks,
  createUser,
  login,
} from './utils'

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

test('lap drafts are edited like time entries and keep manual times', async () => {
  const user = createUser('draft-participant', 'admin')
  const socket = await login(user)
  const now = new Date('2030-01-14T12:00:00.000Z')
  const session = await startedSession(socket, now)
  const [track] = createTracks()
  const game = capture(now, 1, 'turbo')
  game.start()
  game.finish(1, 0, 12000)
  game.finish(2, 0, 10000)
  const draft = WebhookManager.getAllDrafts(session).timeEntries[0]
  assert(draft)
  expect(draft).not.toHaveProperty('webhookCapture')
  expect(draft).toMatchObject({ duration: 10000, publicationState: 'draft' })

  assertResponse(
    await TimeEntryManager.onEditTimeEntry(socket, {
      type: 'EditTimeEntryRequest',
      id: draft.id,
      user: user.id,
      track: track.id,
      duration: 11000,
      chugDurationMs: 2000,
    })
  )
  expect(broadcast).toHaveBeenCalledWith(
    'all_result_drafts',
    WebhookManager.getAllDrafts(),
    socket.id
  )
  game.throttle(3, 0, 500)
  game.finish(4, 0, 9000)
  game.end(5)
  expect(WebhookManager.getAllDrafts(session).timeEntries[0]).toMatchObject({
    user: user.id,
    track: track.id,
    duration: 11000,
    chugDurationMs: 2000,
  })
  expect(
    (await TimeEntryManager.getAllTimeEntries()).some(e => e.id === draft.id)
  ).toBe(false)

  const request: ResultDraftRequest = { kind: 'lap', id: draft.id }
  assertResponse(await WebhookManager.onPublish(socket, request))
  expect(
    (await TimeEntryManager.getAllTimeEntries()).find(e => e.id === draft.id)
  ).toMatchObject({
    duration: 11000,
    chugDurationMs: 2000,
    status: 'completed',
    publicationState: 'published',
    webhookCapture: null,
  })
  expect(WebhookManager.getAllDrafts(session).timeEntries).toEqual([])
  assertResponse(await WebhookManager.onPublish(socket, request))
})

test('match drafts publish only complete results from moderator edits', async () => {
  const admin = await login(createUser('match-draft-admin', 'admin'))
  const first = createUser('match-draft-first')
  const second = createUser('match-draft-second')
  const claimant = await login(first)
  const outsider = await login(createUser('match-draft-outsider'))
  const now = new Date('2030-01-15T12:00:00.000Z')
  const session = await startedSession(admin, now)
  const [track, otherTrack] = createTracks(2)
  db.update(tracks)
    .set({ uid: 'another-map' })
    .where(eq(tracks.id, otherTrack.id))
    .run()
  const game = capture(now, 2, 'next')
  game.start({
    uid: 'match-draft-map',
    name: 'Draft map',
    author: 'Author',
    environment: 'Stadium',
    type: 'Race',
    isLaps: false,
    checkpointsPerLap: 1,
    medalTimesMs: { author: 10000, gold: 12000, silver: 14000, bronze: 16000 },
  })
  game.finish(1, 0, 12000)
  game.finish(2, 1, 14000)
  const draft = WebhookManager.getAllDrafts(session).matches[0]
  assert(draft)
  expect(draft).toMatchObject({
    user1DurationMs: 12000,
    user2DurationMs: 14000,
  })
  const request: ResultDraftRequest = { kind: 'match', id: draft.id }
  await assert.rejects(
    AdminManager.onImportCsv(admin, {
      table: 'matches',
      content: `id,publicationState,status\n${draft.id},published,completed`,
    }),
    /Result drafts cannot be imported/
  )

  const edit = (socket: TypedSocket, track: string) =>
    MatchManager.onEditMatch(socket, {
      type: 'EditMatchRequest',
      id: draft.id,
      user1: first.id,
      user2: second.id,
      track,
    })
  await assert.rejects(edit(claimant, track.id))
  assertResponse(await edit(admin, otherTrack.id))
  await assert.rejects(
    WebhookManager.onPublish(claimant, request),
    /Waiting for end event/
  )
  assertResponse(await edit(admin, track.id))
  game.end(3)
  await assert.rejects(
    WebhookManager.onPublish(outsider, request),
    /Insufficient permissions/
  )
  expect(
    (await MatchManager.getAllMatches()).some(row => row.id === draft.id)
  ).toBe(false)

  assertResponse(await WebhookManager.onPublish(claimant, request))
  expect(
    (await MatchManager.getAllMatches()).find(row => row.id === draft.id)
  ).toMatchObject({
    winner: first.id,
    duration: 12000,
    publicationState: 'published',
    webhookCapture: null,
  })
  expect(db.select().from(tracks).where(eq(tracks.id, track.id)).get()).toEqual(
    track
  )
  expect(WebhookManager.getAllDrafts(session).matches).toEqual([])
})

test('regular users claim unclaimed lap drafts and deleted drafts cannot publish', async () => {
  const admin = await login(createUser('deleted-draft-admin', 'admin'))
  const participant = createUser('deleted-draft-participant')
  const claimant = await login(participant)
  const outsider = await login(createUser('deleted-draft-outsider'))
  const now = new Date('2030-01-16T12:00:00.000Z')
  const session = await startedSession(admin, now)
  const [track] = createTracks()
  const game = capture(now, 1, 'turbo')
  game.start()
  game.finish(1, 0, 12000)
  game.end(2)
  const draft = WebhookManager.getAllDrafts(session).timeEntries[0]
  assert(draft)
  const claim = (socket: TypedSocket, user: string) =>
    TimeEntryManager.onEditTimeEntry(socket, {
      type: 'EditTimeEntryRequest',
      id: draft.id,
      user,
      track: track.id,
    })

  assertResponse(await claim(claimant, participant.id))
  await assert.rejects(claim(outsider, participant.id))
  assertResponse(
    await UserManager.onDeleteUser(admin, {
      type: 'DeleteUserRequest',
      id: participant.id,
    })
  )
  expect(
    db.select().from(timeEntries).where(eq(timeEntries.id, draft.id)).get()
      ?.deletedAt
  ).not.toBeNull()
  await assert.rejects(
    WebhookManager.onPublish(admin, { kind: 'lap', id: draft.id }),
    /Result draft was deleted/
  )
  expect(WebhookManager.getAllDrafts(session).timeEntries).toEqual([])
})

test('webhooks create missing tracks and later captures reuse their uid', async () => {
  const admin = await login(createUser('metadata-track-admin', 'admin'))
  const now = new Date('2031-01-15T12:00:00.000Z')
  const session = await startedSession(admin, now)
  const map: Map = {
    uid: 'explicit-track-map',
    name: 'Webhook track',
    author: 'Mapper',
    environment: 'Stadium',
    type: 'Race',
    isLaps: false,
    checkpointsPerLap: 2,
    medalTimesMs: { author: 10000, gold: 12000, silver: 14000, bronze: 16000 },
  }
  const first = capture(now, 1, 'next')
  first.start(map)
  const draft = WebhookManager.getAllDrafts(session).timeEntries[0]
  assert(draft)
  const track = db.select().from(tracks).where(eq(tracks.uid, map.uid)).get()
  assert(track)
  expect(draft.track).toBe(track.id)
  expect(track).toMatchObject({
    uid: map.uid,
    name: map.name,
    author: map.author,
    game: 'next',
    mapType: map.type,
    level: 'custom',
    goldMedalMs: 12000,
  })
  const second = capture(now, 1, 'next')
  second.start(map)
  expect(
    WebhookManager.getAllDrafts(session).timeEntries.some(
      row => row.id !== draft.id && row.track === track.id
    )
  ).toBe(true)
  const third = capture(now, 1, 'next')
  third.start()
  expect(
    WebhookManager.getAllDrafts(session).timeEntries.filter(
      row => row.track === null
    )
  ).toHaveLength(1)
  expect(
    db.select().from(tracks).where(eq(tracks.uid, map.uid)).all()
  ).toHaveLength(1)
})
