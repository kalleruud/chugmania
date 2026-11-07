import { expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import db from '../backend/database/database'
import { tracks } from '../backend/database/schema'
import AdminManager from '../backend/src/managers/admin.manager'
import MatchManager from '../backend/src/managers/match.manager'
import SessionManager from '../backend/src/managers/session.manager'
import WebhookManager from '../backend/src/managers/webhook.manager'
import type { Event, Source } from '../backend/src/models/webhook.generated'
import { broadcast } from '../backend/src/server'
import type { ResultDraftRequest } from '../common/models/resultDraft'
import {
  assertResponse,
  createSession,
  createTracks,
  createUser,
  login,
} from './utils'

test('corrected lap drafts expose only result fields and publish idempotently', async () => {
  const user = createUser('draft-participant', 'admin')
  const socket = await login(user)
  const session = await createSession(socket, [])
  const [track] = createTracks()
  const game = { gameId: randomUUID(), totalPlayers: 1 }
  const now = new Date('2030-01-14T12:00:00.000Z')
  assertResponse(
    await SessionManager.onEditSession(socket, {
      type: 'EditSessionRequest',
      id: session.id,
      date: now,
    })
  )
  const source: Source = {
    pluginName: 'TM Webhooks',
    pluginVersion: '1.0.0',
    game: 'turbo',
  }
  const base = {
    schemaVersion: '1.0.0',
    occurredAt: now.toISOString(),
    game,
    source,
  }
  const events: Event[] = [
    {
      ...base,
      eventId: randomUUID(),
      type: 'start',
      sequence: 0,
      durationMs: 0,
      players: [{ playerIndex: 0, name: 'Private player' }],
      map: null,
      mode: null,
    },
    {
      ...base,
      eventId: randomUUID(),
      type: 'end',
      sequence: 1,
      durationMs: 12000,
      endReason: 'completed',
    },
  ]
  for (const event of events)
    WebhookManager.receive(event, JSON.stringify(event), now)
  const draft = WebhookManager.getAllDrafts(session.id).timeEntries[0]
  expect(draft).toBeDefined()
  expect(draft).not.toHaveProperty('webhookCapture')
  const request: ResultDraftRequest = { kind: 'lap', id: draft.id }
  assertResponse(
    await WebhookManager.onClaim(socket, { ...request, playerIndex: 0 })
  )
  assertResponse(
    await WebhookManager.onSelectTrack(socket, { ...request, track: track.id })
  )
  assertResponse(
    await WebhookManager.onEditTimes(socket, {
      ...request,
      playerIndex: 0,
      finishDurationMs: 12000,
      chugDurationMs: 2000,
    })
  )
  expect(WebhookManager.getAllDrafts(session.id).timeEntries[0]).toMatchObject({
    user: user.id,
    track: track.id,
    duration: 12000,
    chugDurationMs: 2000,
  })
  assertResponse(await WebhookManager.onPublish(socket, request))
  expect(WebhookManager.getAllDrafts(session.id).timeEntries).toEqual([])
  assertResponse(await WebhookManager.onPublish(socket, request))
})

test('match drafts enforce participant permissions and publish only complete results', async () => {
  const admin = await login(createUser('match-draft-admin', 'admin'))
  const first = createUser('match-draft-first')
  const second = createUser('match-draft-second')
  const claimant = await login(first)
  const outsider = await login(createUser('match-draft-outsider'))
  const session = await createSession(admin, [])
  const now = new Date('2030-01-15T12:00:00.000Z')
  assertResponse(
    await SessionManager.onEditSession(admin, {
      type: 'EditSessionRequest',
      id: session.id,
      date: now,
    })
  )
  const [track] = createTracks()
  const source: Source = {
    pluginName: 'TM Webhooks',
    pluginVersion: '1.0.0',
    game: 'next',
  }
  const base = {
    schemaVersion: '1.0.0',
    occurredAt: now.toISOString(),
    game: { gameId: randomUUID(), totalPlayers: 2 },
    source,
  }
  const start: Event = {
    ...base,
    eventId: randomUUID(),
    type: 'start',
    sequence: 0,
    durationMs: 0,
    players: [
      { playerIndex: 0, name: 'Private first' },
      { playerIndex: 1, name: 'Private second' },
    ],
    map: {
      uid: 'match-draft-map',
      name: 'Draft map',
      author: 'Author',
      environment: 'Stadium',
      type: 'Race',
      isLaps: false,
      checkpointsPerLap: 1,
      medalTimesMs: {
        author: 10000,
        gold: 12000,
        silver: 14000,
        bronze: 16000,
      },
    },
    mode: null,
  }
  const end: Event = {
    ...base,
    eventId: randomUUID(),
    type: 'end',
    sequence: 3,
    durationMs: 15000,
    endReason: 'completed',
  }
  WebhookManager.receive(start, JSON.stringify(start), now)
  for (const player of start.players) {
    const finish: Event = {
      ...base,
      eventId: randomUUID(),
      type: 'finish',
      sequence: player.playerIndex + 1,
      durationMs: 12000 + player.playerIndex * 2000,
      player,
      checkpoint: { checkpointIndex: 2, checkpointLapIndex: 2, lapNumber: 1 },
    }
    WebhookManager.receive(finish, JSON.stringify(finish), now)
  }
  expect(WebhookManager.getAllDrafts(session.id).matches[0]).toMatchObject({
    user1DurationMs: 12000,
    user2DurationMs: 14000,
  })
  const draft = WebhookManager.getAllDrafts(session.id).matches[0]
  assert(draft)
  const request: ResultDraftRequest = { kind: 'match', id: draft.id }
  await assert.rejects(
    AdminManager.onImportCsv(admin, {
      table: 'matches',
      content: `id,publicationState,status\n${draft.id},published,completed`,
    }),
    /Result drafts cannot be imported/
  )
  await assert.rejects(
    AdminManager.onImportCsv(admin, {
      table: 'matches',
      content: 'id,publicationState\norphan-draft,draft',
    }),
    /Result drafts cannot be imported/
  )
  expect(
    WebhookManager.getAllDrafts(session.id).matches[0].publicationState
  ).toBe('draft')

  assertResponse(
    await WebhookManager.onClaim(claimant, { ...request, playerIndex: 0 })
  )
  await assert.rejects(
    WebhookManager.onClaim(outsider, { ...request, playerIndex: 0 })
  )
  await assert.rejects(
    WebhookManager.onAssign(claimant, {
      ...request,
      playerIndex: 1,
      user: second.id,
    })
  )
  assertResponse(
    await WebhookManager.onAssign(admin, {
      ...request,
      playerIndex: 1,
      user: second.id,
    })
  )
  const [otherTrack] = createTracks()
  db.update(tracks)
    .set({ uid: 'another-map' })
    .where(eq(tracks.id, otherTrack.id))
    .run()
  await assert.rejects(
    WebhookManager.onSelectTrack(admin, { ...request, track: otherTrack.id }),
    /Track belongs to another map/
  )
  expect(
    db.select().from(tracks).where(eq(tracks.id, otherTrack.id)).get()
  ).toMatchObject({ uid: 'another-map', name: otherTrack.name })
  assertResponse(
    await WebhookManager.onSelectTrack(admin, { ...request, track: track.id })
  )
  await assert.rejects(
    WebhookManager.onEditTimes(outsider, {
      ...request,
      playerIndex: 0,
      finishDurationMs: 12000,
    })
  )
  assertResponse(
    await WebhookManager.onEditTimes(claimant, {
      ...request,
      playerIndex: 0,
      finishDurationMs: 12000,
      chugDurationMs: 0,
    })
  )
  assertResponse(
    await WebhookManager.onEditTimes(admin, {
      ...request,
      playerIndex: 1,
      finishDurationMs: 14000,
    })
  )
  await assert.rejects(
    WebhookManager.onPublish(claimant, request),
    /Waiting for end event/
  )
  expect(
    (await MatchManager.getAllMatches()).some(row => row.id === draft.id)
  ).toBe(false)
  WebhookManager.receive(end, JSON.stringify(end), now)
  await assert.rejects(
    WebhookManager.onPublish(outsider, request),
    /Insufficient permissions/
  )
  assertResponse(await WebhookManager.onPublish(claimant, request))
  const published = (await MatchManager.getAllMatches()).find(
    row => row.id === draft.id
  )
  expect(published).toMatchObject({
    winner: first.id,
    duration: 12000,
    user1DurationMs: 12000,
    user2DurationMs: 14000,
    user1ChugDurationMs: 0,
    user2ChugDurationMs: null,
    publicationState: 'published',
    webhookCapture: null,
  })
  expect(WebhookManager.getAllDrafts(session.id).matches).toEqual([])
  expect(broadcast).toHaveBeenCalledWith(
    'all_result_drafts',
    WebhookManager.getAllDrafts(),
    claimant.id
  )
  assertResponse(await WebhookManager.onPublish(claimant, request))
  WebhookManager.receive(
    end,
    JSON.stringify(end),
    new Date('2030-02-01T12:00:00.000Z')
  )
  expect(
    (await MatchManager.getAllMatches()).filter(row => row.id === draft.id)
  ).toHaveLength(1)
})
