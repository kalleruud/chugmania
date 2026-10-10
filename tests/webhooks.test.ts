import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { and, eq, sql } from 'drizzle-orm'
import { DateTime } from 'luxon'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  matches,
  sessions,
  timeEntries,
  tracks,
  webhookCaptures,
  webhookEvents,
} from '../backend/database/schema'
import AdminManager from '../backend/src/managers/admin.manager'
import MatchManager from '../backend/src/managers/match.manager'
import RatingManager from '../backend/src/managers/rating.manager'
import SessionManager from '../backend/src/managers/session.manager'
import TimeEntryManager from '../backend/src/managers/timeEntry.manager'
import TrackManager from '../backend/src/managers/track.manager'
import WebhookManager from '../backend/src/managers/webhook.manager'
import {
  isCreateMatchRequest,
  isEditMatchRequest,
} from '../common/models/match'
import {
  isCreateTimeEntryRequest,
  isEditTimeEntryRequest,
} from '../common/models/timeEntry'
import { isWebhookEvent, type WebhookEvent } from '../common/models/webhook'
import nextFixture from './fixtures/webhook.next.json'
import turboFixture from './fixtures/webhook.turbo.json'
import { broadcast, db, startWebhookReceiver } from './setup'
import {
  assertResponse,
  createSession,
  createTracks,
  createUser,
  login,
} from './utils'

let receiver: Awaited<ReturnType<typeof startWebhookReceiver>>
const token = 'webhook-test-token'
beforeAll(async () => {
  process.env.TRACKMANIA_WEBHOOK_TOKEN = token
  receiver = await startWebhookReceiver()
})
afterAll(async () => {
  await receiver.close()
  delete process.env.TRACKMANIA_WEBHOOK_TOKEN
})

function fixture(next = false): WebhookEvent[] {
  const gameId = randomUUID()
  return (next ? nextFixture : turboFixture).map(value => {
    const event: unknown = {
      ...structuredClone(value),
      eventId: randomUUID(),
      game: { ...value.game, gameId },
    }
    assert(isWebhookEvent(event))
    if (event.type === 'start' && event.map) event.map.uid = randomUUID()
    return event
  })
}
async function post(
  event: WebhookEvent,
  headers: Record<string, string> = {},
  body = JSON.stringify(event)
) {
  return fetch(receiver.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
      event_type: event.type,
      'event-id': event.eventId,
      'event-sequence': String(event.sequence),
      ...headers,
    },
    body,
  })
}
async function replay(events: WebhookEvent[]) {
  for (const event of events) expect((await post(event)).status).toBe(204)
}
async function context(name: string, next = false) {
  const admin = createUser(`webhook-${name}-admin`, 'admin')
  const player = createUser(`webhook-${name}-player`)
  const opponent = createUser(`webhook-${name}-opponent`)
  const [adminSocket, socket, opponentSocket] = await Promise.all([
    login(admin),
    login(player),
    login(opponent),
  ])
  const session = await createSession(adminSocket, [])
  assertResponse(
    await SessionManager.onEditSession(adminSocket, {
      type: 'EditSessionRequest',
      id: session.id,
      date: new Date(Date.now() - 1),
    })
  )
  const events = fixture(next)
  const gameId = events[0].game.gameId
  return {
    admin,
    player,
    opponent,
    adminSocket,
    socket,
    opponentSocket,
    session,
    events,
    gameId,
  }
}
function capture(gameId: string) {
  const result = db
    .select()
    .from(webhookCaptures)
    .where(eq(webhookCaptures.gameId, gameId))
    .get()
  assert(result)
  return result
}
function draft(gameId: string) {
  const c = capture(gameId)
  const result = WebhookManager.getDrafts(c.session).drafts.find(
    d => d.gameId === gameId
  )
  assert(result)
  return result
}
async function prepare(c: Awaited<ReturnType<typeof context>>) {
  await replay(c.events)
  assertResponse(
    await WebhookManager.onCreateTrack(c.adminSocket, { gameId: c.gameId })
  )
  assertResponse(
    await WebhookManager.onClaim(c.socket, { gameId: c.gameId, playerIndex: 0 })
  )
  if (c.events[0].game.totalPlayers === 2)
    assertResponse(
      await WebhookManager.onClaim(c.opponentSocket, {
        gameId: c.gameId,
        playerIndex: 1,
      })
    )
}

describe('Trackmania webhook ingestion and drafts', () => {
  test.serial(
    'Rejects unauthorized and invalid requests without storing anything; no session is retryable',
    async () => {
      const event = fixture()[0]
      const count = () =>
        db
          .select({ count: sql<number>`count(*)` })
          .from(webhookEvents)
          .get()?.count
      const before = count()
      expect((await post(event, { Authorization: '' })).status).toBe(401)
      expect(
        (await post(event, { Authorization: 'Bearer wrong' })).status
      ).toBe(401)
      delete process.env.TRACKMANIA_WEBHOOK_TOKEN
      expect((await post(event)).status).toBe(401)
      process.env.TRACKMANIA_WEBHOOK_TOKEN = token
      expect((await post(event, {}, '{')).status).toBe(400)
      expect((await post(event, { 'event-sequence': '9' })).status).toBe(400)
      expect((await post(event, { event_type: 'finish' })).status).toBe(400)
      expect((await post(event, { 'event-id': randomUUID() })).status).toBe(400)
      expect(
        (
          await post(
            event,
            {},
            JSON.stringify({
              ...event,
              game: { ...event.game, totalPlayers: 3 },
            })
          )
        ).status
      ).toBe(400)
      expect(
        (
          await post(
            event,
            {},
            JSON.stringify({ ...event, schemaVersion: '2.0.0' })
          )
        ).status
      ).toBe(400)
      expect(
        (
          await post(
            event,
            {},
            JSON.stringify({ ...event, occurredAt: '2026-02-30T12:00:00.000Z' })
          )
        ).status
      ).toBe(400)
      expect(
        (await post(event, {}, JSON.stringify({ ...event, type: ['start'] })))
          .status
      ).toBe(400)
      const invalidEnd = fixture().at(-1)
      assert(invalidEnd)
      expect(
        (
          await post(
            invalidEnd,
            {},
            JSON.stringify({ ...invalidEnd, endReason: ['completed'] })
          )
        ).status
      ).toBe(400)
      const response = await post(event)
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        code: 'NO_ACTIVE_SESSION',
        message: 'No active receiver session can register this event',
      })
      expect(count()).toBe(before)
      expect(
        db
          .select()
          .from(webhookCaptures)
          .where(eq(webhookCaptures.gameId, event.game.gameId))
          .get()
      ).toBeUndefined()
      const c = await context('retry')
      expect((await post(event)).status).toBe(204)
      expect(capture(event.game.gameId).session).toBe(c.session.id)
    }
  )

  test.serial(
    'Sequentially receives Turbo events, recovers after receiver restart, and publishes only after end',
    async () => {
      const c = await context('turbo')
      const initialRatings = RatingManager.onGetRatings()
      let previous: string | undefined
      for (const [index, event] of c.events.entries()) {
        if (index === 3) {
          await receiver.close()
          receiver = await startWebhookReceiver()
        }
        const raw = JSON.stringify({
          ...event,
          futureExtension: { retained: true },
        })
        expect((await post(event, {}, raw)).status).toBe(204)
        const current = draft(c.gameId)
        const stored = db
          .select()
          .from(webhookEvents)
          .where(eq(webhookEvents.capture, capture(c.gameId).id))
          .orderBy(webhookEvents.sequence)
          .all()
        expect(stored.length).toBe(index + 1)
        expect(stored.at(-1)?.rawPayload).toBe(raw)
        expect(stored.map(row => row.sequence)).toEqual(
          Array.from({ length: index + 1 }, (_, i) => i)
        )
        expect(
          (await TimeEntryManager.getAllTimeEntries()).some(
            row => row.webhookCapture === capture(c.gameId).id
          )
        ).toBe(false)
        expect(TimeEntryManager.getAllLatestAfterSession(c.session.id)).toEqual(
          []
        )
        expect(
          (await SessionManager.getSession(c.session.id))?.signups
        ).toEqual([])
        RatingManager.recalculate()
        expect(RatingManager.onGetRatings()).toEqual(initialRatings)
        if (index === 0) {
          assertResponse(
            await WebhookManager.onCreateTrack(c.adminSocket, {
              gameId: c.gameId,
            })
          )
          assertResponse(
            await WebhookManager.onClaim(c.socket, {
              gameId: c.gameId,
              playerIndex: 0,
            })
          )
        }
        if (event.type !== 'end')
          await assert.rejects(
            WebhookManager.onPublish(c.socket, { gameId: c.gameId })
          )
        const snapshot = WebhookManager.getDrafts(c.session.id)
        const notification = broadcast.mock.calls
          .filter(call => call[0] === 'webhook_drafts_changed')
          .at(-1)
        if (previous !== JSON.stringify(current))
          expect(notification?.[1]).toEqual(snapshot)
        previous = JSON.stringify(current)
        const emissions = broadcast.mock.calls.length
        expect((await post(event, {}, raw)).status).toBe(204)
        expect(broadcast.mock.calls.length).toBe(emissions)
      }
      expect(draft(c.gameId).blockers).toEqual([])
      assertResponse(
        await WebhookManager.onPublish(c.socket, { gameId: c.gameId })
      )
      const published = (await TimeEntryManager.getAllTimeEntries()).find(
        row => row.webhookCapture === capture(c.gameId).id
      )
      assert(published)
      expect(published.duration).toBe(28000)
      expect(published.chugDurationMs).toBe(125)
      expect(published.publicationState).toBe('published')
      expect(WebhookManager.getDrafts(c.session.id).drafts).toEqual([])
      expect(
        (await SessionManager.getSession(c.session.id))?.signups.map(
          s => s.user.id
        )
      ).toContain(c.player.id)
      expect(RatingManager.getUserRatings(c.player.id)).toBeDefined()
      const audit = await WebhookManager.onGetEvents(c.socket, {
        gameId: c.gameId,
      })
      assertResponse(audit)
      expect(audit.events.length).toBe(7)
      const emissions = broadcast.mock.calls.length
      assertResponse(
        await WebhookManager.onPublish(c.socket, { gameId: c.gameId })
      )
      expect(broadcast.mock.calls.length).toBe(emissions)
      const late: WebhookEvent = {
        ...c.events[1],
        eventId: randomUUID(),
        sequence: 7,
        durationMs: 999,
      }
      expect((await post(late)).status).toBe(204)
      expect(
        (await TimeEntryManager.getAllTimeEntries()).find(
          row => row.id === published.id
        )?.chugDurationMs
      ).toBe(125)
      await assert.rejects(
        WebhookManager.onGetEvents(c.opponentSocket, { gameId: c.gameId })
      )
    }
  )

  test.serial(
    'Sequential Next winner-only capture publishes with a DNF and optional chug duration',
    async () => {
      const c = await context('next', true)
      for (const event of c.events) {
        expect((await post(event)).status).toBe(204)
        expect(
          (await MatchManager.getAllMatches()).some(
            row => row.webhookCapture === capture(c.gameId).id
          )
        ).toBe(false)
        expect(MatchManager.getAllBySession(c.session.id)).toEqual([])
      }
      assertResponse(
        await WebhookManager.onCreateTrack(c.adminSocket, { gameId: c.gameId })
      )
      assertResponse(
        await WebhookManager.onClaim(c.socket, {
          gameId: c.gameId,
          playerIndex: 0,
        })
      )
      await assert.rejects(
        WebhookManager.onPublish(c.socket, { gameId: c.gameId })
      )
      assertResponse(
        await WebhookManager.onClaim(c.opponentSocket, {
          gameId: c.gameId,
          playerIndex: 1,
        })
      )
      assertResponse(
        await WebhookManager.onPublish(c.opponentSocket, { gameId: c.gameId })
      )
      const published = (await MatchManager.getAllMatches()).find(
        row => row.webhookCapture === capture(c.gameId).id
      )
      assert(published)
      expect(published.winner).toBe(c.player.id)
      expect(published.duration).toBe(41000)
      expect(published.user1DurationMs).toBe(41000)
      expect(published.user2DurationMs).toBeNull()
      expect(published.user1ChugDurationMs).toBe(150)
      expect(published.user2ChugDurationMs).toBeNull()
      expect(published.tournament).toBeUndefined()
      expect(RatingManager.getUserRatings(c.player.id)).toBeDefined()
    }
  )

  test.serial(
    'Two finishes choose the minimum regardless of arrival; ties and absent finishes remain drafts',
    async () => {
      const c = await context('finishes', true)
      const finish = c.events.find(e => e.type === 'finish')
      assert(finish && finish.type === 'finish')
      const end = c.events.at(-1)
      assert(end && end.type === 'end')
      const second: WebhookEvent = {
        ...finish,
        eventId: randomUUID(),
        sequence: 4,
        durationMs: 40000,
        player: { playerIndex: 1, name: 'Driver Two' },
      }
      c.events = [...c.events.slice(0, 4), second, { ...end, sequence: 5 }]
      await prepare(c)
      assertResponse(
        await WebhookManager.onPublish(c.socket, { gameId: c.gameId })
      )
      expect(
        MatchManager.getAllBySession(c.session.id).find(
          row => row.webhookCapture === capture(c.gameId).id
        )?.winner
      ).toBe(c.opponent.id)
      const tied = await context('tie', true)
      const tiedFinish = tied.events.find(e => e.type === 'finish')
      const tiedEnd = tied.events.at(-1)
      assert(
        tiedFinish &&
          tiedFinish.type === 'finish' &&
          tiedEnd &&
          tiedEnd.type === 'end'
      )
      tied.events = [
        ...tied.events.slice(0, 4),
        {
          ...tiedFinish,
          eventId: randomUUID(),
          sequence: 4,
          player: { playerIndex: 1, name: 'Driver Two' },
        },
        { ...tiedEnd, sequence: 5 },
      ]
      await prepare(tied)
      expect(draft(tied.gameId).blockers).toContain('Finish times are tied')
      await assert.rejects(
        WebhookManager.onPublish(tied.socket, { gameId: tied.gameId })
      )
      const none = await context('no-finish')
      const noneEnd = none.events.at(-1)
      assert(noneEnd && noneEnd.type === 'end')
      none.events = [...none.events.slice(0, 5), { ...noneEnd, sequence: 5 }]
      await prepare(none)
      await assert.rejects(
        WebhookManager.onPublish(none.socket, { gameId: none.gameId })
      )
    }
  )

  test.serial(
    'Persists partial and out-of-order events; rejects conflicts and waits for gaps',
    async () => {
      const c = await context('partial')
      expect((await post(c.events[1])).status).toBe(204)
      expect(WebhookManager.getDrafts(c.session.id).drafts).toEqual([])
      await assert.rejects(
        WebhookManager.onPublish(c.adminSocket, { gameId: c.gameId })
      )
      expect((await post(c.events[0])).status).toBe(204)
      const end = c.events.at(-1)
      assert(end)
      expect((await post(end)).status).toBe(204)
      expect(draft(c.gameId).blockers).toContain('Missing webhook events')
      const conflict = { ...c.events[1], durationMs: 500 }
      expect((await post(conflict)).status).toBe(409)
      expect(
        (await post({ ...c.events[1], eventId: randomUUID() })).status
      ).toBe(409)
      expect(
        (
          await post({
            ...c.events[2],
            game: { ...c.events[2].game, totalPlayers: 2 },
          })
        ).status
      ).toBe(409)
      const mismatch = c.events[2]
      assert('player' in mismatch)
      expect(
        (
          await post({
            ...mismatch,
            player: { ...mismatch.player, name: 'Someone Else' },
          })
        ).status
      ).toBe(409)
      await replay(c.events.slice(2, 6))
      assertResponse(
        await WebhookManager.onCreateTrack(c.adminSocket, { gameId: c.gameId })
      )
      assertResponse(
        await WebhookManager.onClaim(c.socket, {
          gameId: c.gameId,
          playerIndex: 0,
        })
      )
      expect(draft(c.gameId).blockers).toEqual([])
      assertResponse(
        await WebhookManager.onPublish(c.socket, { gameId: c.gameId })
      )
    }
  )

  test.serial(
    'Claims are exclusive and regular users cannot assign, select, discard or bypass publication',
    async () => {
      const c = await context('permissions', true)
      await replay(c.events)
      assertResponse(
        await WebhookManager.onClaim(c.socket, {
          gameId: c.gameId,
          playerIndex: 0,
        })
      )
      await assert.rejects(
        WebhookManager.onClaim(c.opponentSocket, {
          gameId: c.gameId,
          playerIndex: 0,
        })
      )
      await assert.rejects(
        WebhookManager.onClaim(c.socket, { gameId: c.gameId, playerIndex: 1 })
      )
      await assert.rejects(
        WebhookManager.onClaim(c.opponentSocket, {
          gameId: c.gameId,
          playerIndex: 0,
          release: true,
        })
      )
      await assert.rejects(
        WebhookManager.onAssign(c.socket, {
          gameId: c.gameId,
          playerIndex: 1,
          user: c.opponent.id,
        })
      )
      await assert.rejects(
        WebhookManager.onCreateTrack(c.socket, { gameId: c.gameId })
      )
      const [track] = createTracks()
      await assert.rejects(
        WebhookManager.onSelectTrack(c.socket, {
          gameId: c.gameId,
          track: track.id,
        })
      )
      await assert.rejects(
        WebhookManager.onDiscard(c.socket, { gameId: c.gameId })
      )
      await assert.rejects(
        WebhookManager.onPublish(c.opponentSocket, { gameId: c.gameId })
      )
      assertResponse(
        await WebhookManager.onClaim(c.socket, {
          gameId: c.gameId,
          playerIndex: 0,
          release: true,
        })
      )
      assertResponse(
        await WebhookManager.onAssign(c.adminSocket, {
          gameId: c.gameId,
          playerIndex: 0,
          user: c.player.id,
        })
      )
      await assert.rejects(
        WebhookManager.onAssign(c.adminSocket, {
          gameId: c.gameId,
          playerIndex: 1,
          user: c.player.id,
        })
      )
      const row = db
        .select()
        .from(matches)
        .where(eq(matches.webhookCapture, capture(c.gameId).id))
        .get()
      assert(row)
      await assert.rejects(
        MatchManager.onEditMatch(c.adminSocket, {
          type: 'EditMatchRequest',
          id: row.id,
          status: 'completed',
        })
      )
      expect(
        isCreateMatchRequest({
          type: 'CreateMatchRequest',
          track: track.id,
          publicationState: 'draft',
        })
      ).toBe(false)
      expect(
        isEditMatchRequest({
          type: 'EditMatchRequest',
          id: row.id,
          webhookCapture: c.gameId,
        })
      ).toBe(false)
      expect(
        isCreateTimeEntryRequest({
          type: 'CreateTimeEntryRequest',
          user: c.player.id,
          track: track.id,
          publicationState: 'draft',
        })
      ).toBe(false)
      expect(
        isEditTimeEntryRequest({
          type: 'EditTimeEntryRequest',
          id: row.id,
          chugDurationMs: 1,
        })
      ).toBe(false)
      assertResponse(
        await WebhookManager.onDiscard(c.adminSocket, { gameId: c.gameId })
      )
      const event = { ...c.events[1], eventId: randomUUID(), sequence: 5 }
      expect((await post(event)).status).toBe(204)
      expect(WebhookManager.getDrafts(c.session.id).drafts).toEqual([])
      await assert.rejects(
        WebhookManager.onClaim(c.socket, { gameId: c.gameId, playerIndex: 0 })
      )
    }
  )

  test.serial(
    'Matches tracks by UID only; creates named maps and supports null maps',
    async () => {
      const c = await context('tracks')
      const start = c.events[0]
      assert(start.type === 'start' && start.map)
      const [legacy] = createTracks()
      db.update(tracks)
        .set({ name: start.map.name })
        .where(eq(tracks.id, legacy.id))
        .run()
      await replay(c.events)
      expect(draft(c.gameId).track).toBeNull()
      expect(await TrackManager.getTrackIdsWithLapTimes()).not.toContain(
        legacy.id
      )
      assertResponse(
        await WebhookManager.onCreateTrack(c.adminSocket, { gameId: c.gameId })
      )
      const id = draft(c.gameId).track
      assert(id)
      const named = db.select().from(tracks).where(eq(tracks.id, id)).get()
      assert(named)
      expect(named.number).toBeNull()
      expect(named.type).toBeNull()
      expect(named.level).toBe('custom')
      expect(named.uid).toBe(start.map.uid)
      expect(named.goldMedalMs).toBe(start.map.medalTimesMs.gold)
      expect(named.isLaps).toBe(true)
      const another = fixture()
      const anotherStart = another[0]
      assert(anotherStart.type === 'start')
      anotherStart.map = structuredClone(start.map)
      await replay(another)
      expect(draft(another[0].game.gameId).track).toBe(id)
      assertResponse(
        await WebhookManager.onCreateTrack(c.adminSocket, {
          gameId: another[0].game.gameId,
        })
      )
      expect(
        db.select().from(tracks).where(eq(tracks.uid, start.map.uid)).all()
          .length
      ).toBe(1)
      const nullMap = await context('null-map')
      assert(nullMap.events[0].type === 'start')
      nullMap.events[0].map = null
      await replay(nullMap.events)
      await assert.rejects(
        WebhookManager.onCreateTrack(nullMap.adminSocket, {
          gameId: nullMap.gameId,
        })
      )
      assertResponse(
        await WebhookManager.onSelectTrack(nullMap.adminSocket, {
          gameId: nullMap.gameId,
          track: legacy.id,
        })
      )
      expect(draft(nullMap.gameId).track).toBe(legacy.id)
      expect(
        db.select().from(tracks).where(eq(tracks.id, legacy.id)).get()?.uid
      ).toBeNull()
    }
  )

  test.serial(
    'Manual track selection copies map metadata, preserves catalogue identity, and broadcasts the fetched track DTO',
    async () => {
      const c = await context('manual-map-metadata')
      const start = c.events[0]
      assert(start.type === 'start' && start.map)
      const [legacy] = createTracks()
      const existingUid = randomUUID()
      db.update(tracks)
        .set({ uid: existingUid, name: 'Old map', totalLaps: 99 })
        .where(eq(tracks.id, legacy.id))
        .run()
      await replay(c.events)
      expect(draft(c.gameId).track).toBeNull()
      await assert.rejects(
        WebhookManager.onSelectTrack(c.socket, {
          gameId: c.gameId,
          track: legacy.id,
        })
      )
      expect(
        db.select().from(tracks).where(eq(tracks.id, legacy.id)).get()?.name
      ).toBe('Old map')
      broadcast.mockClear()
      assertResponse(
        await WebhookManager.onSelectTrack(c.adminSocket, {
          gameId: c.gameId,
          track: legacy.id,
        })
      )
      expect(draft(c.gameId).track).toBe(legacy.id)
      const updated = (await TrackManager.getAllTracks()).find(
        track => track.id === legacy.id
      )
      assert(updated)
      expect(updated).toMatchObject({
        id: legacy.id,
        uid: existingUid,
        number: legacy.number,
        level: legacy.level,
        type: legacy.type,
        name: start.map.name,
        author: start.map.author,
        environment: start.map.environment,
        mapType: start.map.type,
        authorMedalMs: start.map.medalTimesMs.author,
        goldMedalMs: start.map.medalTimesMs.gold,
        silverMedalMs: start.map.medalTimesMs.silver,
        bronzeMedalMs: start.map.medalTimesMs.bronze,
        isLaps: start.map.isLaps,
        totalLaps: start.map.totalLaps,
        checkpointsPerLap: start.map.checkpointsPerLap,
      })
      expect(updated.updatedAt).not.toBeNull()
      expect(broadcast).toHaveBeenCalledWith(
        'all_tracks',
        await TrackManager.getAllTracks()
      )

      const next = await context('manual-next-metadata', true)
      const nextStart = next.events[0]
      assert(nextStart.type === 'start' && nextStart.map)
      nextStart.map.medalTimesMs.author = 0
      await replay(next.events)
      assertResponse(
        await WebhookManager.onSelectTrack(next.adminSocket, {
          gameId: next.gameId,
          track: legacy.id,
        })
      )
      const nextTrack = db
        .select()
        .from(tracks)
        .where(eq(tracks.id, legacy.id))
        .get()
      assert(nextTrack)
      expect(nextTrack.uid).toBe(existingUid)
      expect(nextTrack.name).toBe(nextStart.map.name)
      expect(nextTrack.authorMedalMs).toBe(0)
      expect(nextTrack.isLaps).toBe(false)
      expect(nextTrack.totalLaps).toBeNull()

      const nullMap = await context('manual-metadata-null')
      assert(nullMap.events[0].type === 'start')
      nullMap.events[0].map = null
      await replay(nullMap.events)
      assertResponse(
        await WebhookManager.onSelectTrack(nullMap.adminSocket, {
          gameId: nullMap.gameId,
          track: legacy.id,
        })
      )
      expect(
        db.select().from(tracks).where(eq(tracks.id, legacy.id)).get()
      ).toEqual(nextTrack)
    }
  )

  test.serial(
    'Every end reason can publish valid finishes and zero chug is retained',
    async () => {
      for (const endReason of [
        'completed',
        'aborted',
        'restarted',
        'unknown',
      ]) {
        const c = await context(`end-${endReason}`)
        c.events = c.events.map(event => {
          if (event.type === 'first_throttle')
            return { ...event, durationMs: 0 }
          if (event.type === 'end') {
            const value: unknown = { ...event, endReason }
            assert(isWebhookEvent(value))
            return value
          }
          return event
        })
        await prepare(c)
        assertResponse(
          await WebhookManager.onPublish(c.socket, { gameId: c.gameId })
        )
        expect(
          (await TimeEntryManager.getAllTimeEntries()).find(
            row => row.webhookCapture === capture(c.gameId).id
          )?.chugDurationMs
        ).toBe(0)
      }
    }
  )

  test.serial(
    'Prunes stale drafts, partial and discarded captures, preserving published audit forever',
    async () => {
      const published = await context('retained')
      await prepare(published)
      assertResponse(
        await WebhookManager.onPublish(published.socket, {
          gameId: published.gameId,
        })
      )
      const unpublished = await context('prune')
      await replay(unpublished.events)
      const partial = fixture()
      expect((await post(partial[1])).status).toBe(204)
      const discarded = fixture()
      await replay(discarded)
      assertResponse(
        await WebhookManager.onDiscard(unpublished.adminSocket, {
          gameId: discarded[0].game.gameId,
        })
      )
      const old = new Date(Date.now() - 8 * 86_400_000)
      for (const gameId of [
        published.gameId,
        unpublished.gameId,
        partial[0].game.gameId,
        discarded[0].game.gameId,
      ])
        db.update(webhookCaptures)
          .set({ createdAt: old })
          .where(eq(webhookCaptures.gameId, gameId))
          .run()
      const row = db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.webhookCapture, capture(published.gameId).id))
        .get()
      assert(row)
      assertResponse(
        await TimeEntryManager.onEditTimeEntry(published.socket, {
          type: 'EditTimeEntryRequest',
          id: row.id,
          deletedAt: new Date(),
        })
      )
      WebhookManager.prune()
      expect(capture(published.gameId).publishedAt).not.toBeNull()
      for (const gameId of [
        unpublished.gameId,
        partial[0].game.gameId,
        discarded[0].game.gameId,
      ])
        expect(
          db
            .select()
            .from(webhookCaptures)
            .where(eq(webhookCaptures.gameId, gameId))
            .get()
        ).toBeUndefined()
      const audit = await WebhookManager.onGetEvents(published.socket, {
        gameId: published.gameId,
      })
      assertResponse(audit)
      expect(audit.events.length).toBe(7)
    }
  )

  test.serial(
    'CSV exports and imports webhook metadata and original payload text',
    async () => {
      const c = await context('csv')
      const raw =
        '  ' +
        JSON.stringify({
          ...c.events[0],
          extension: { text: 'line\n"quoted"' },
        }) +
        '\n'
      expect((await post(c.events[0], {}, raw)).status).toBe(204)
      const stored = db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, c.events[0].eventId))
        .get()
      assert(stored)
      const exported = await AdminManager.onExportCsv(c.adminSocket, {
        table: 'webhookEvents',
      })
      assertResponse(exported)
      assertResponse(
        await AdminManager.onImportCsv(c.adminSocket, {
          table: 'webhookEvents',
          content: exported.csv,
        })
      )
      expect(
        db
          .select()
          .from(webhookEvents)
          .where(eq(webhookEvents.id, stored.id))
          .get()?.rawPayload
      ).toBe(raw)
      assertResponse(
        await WebhookManager.onCreateTrack(c.adminSocket, { gameId: c.gameId })
      )
      const trackId = draft(c.gameId).track
      assert(trackId)
      const exportedTracks = await AdminManager.onExportCsv(c.adminSocket, {
        table: 'tracks',
      })
      assertResponse(exportedTracks)
      assertResponse(
        await AdminManager.onImportCsv(c.adminSocket, {
          table: 'tracks',
          content: exportedTracks.csv,
        })
      )
      expect(
        db.select().from(tracks).where(eq(tracks.id, trackId)).get()?.isLaps
      ).toBe(true)
      const exportedCaptures = await AdminManager.onExportCsv(c.adminSocket, {
        table: 'webhookCaptures',
      })
      assertResponse(exportedCaptures)
      assertResponse(
        await AdminManager.onImportCsv(c.adminSocket, {
          table: 'webhookCaptures',
          content: exportedCaptures.csv,
        })
      )
      expect(capture(c.gameId).createdAt).toBeInstanceOf(Date)
    }
  )
})

test.serial(
  'Session association respects Oslo dates, past starts, status, closest start and fixed linkage',
  () => {
    const now = DateTime.fromISO('2035-10-28T00:30:00', { zone: 'Europe/Oslo' })
    const values = [
      {
        id: 'webhook-date-yesterday',
        date: now.minus({ days: 1, minutes: 10 }).toJSDate(),
      },
      {
        id: 'webhook-date-today-a',
        date: now.minus({ minutes: 10 }).toJSDate(),
      },
      {
        id: 'webhook-date-today-b',
        date: now.minus({ minutes: 10 }).toJSDate(),
      },
      { id: 'webhook-date-future', date: now.plus({ minutes: 10 }).toJSDate() },
      {
        id: 'webhook-date-cancelled',
        date: now.minus({ minutes: 1 }).toJSDate(),
        status: 'cancelled',
      },
      {
        id: 'webhook-date-deleted',
        date: now.minus({ minutes: 1 }).toJSDate(),
        deletedAt: now.toJSDate(),
      },
    ]
    for (const value of values)
      db.insert(sessions)
        .values({
          ...value,
          name: value.id,
          status: value.status === 'cancelled' ? 'cancelled' : 'confirmed',
        })
        .run()
    expect(WebhookManager.findSession(now.toJSDate())?.id).toBe(
      'webhook-date-today-a'
    )
    expect(
      WebhookManager.findSession(now.toJSDate(), 'webhook-date-yesterday')?.id
    ).toBe('webhook-date-yesterday')
    const events = fixture()
    WebhookManager.receive(events[0], JSON.stringify(events[0]), now.toJSDate())
    db.insert(sessions)
      .values({
        id: 'webhook-date-newer',
        name: 'Newer',
        date: now.minus({ minutes: 2 }).toJSDate(),
      })
      .run()
    WebhookManager.receive(events[1], JSON.stringify(events[1]), now.toJSDate())
    expect(capture(events[0].game.gameId).session).toBe('webhook-date-today-a')
    const later = now.plus({ days: 2 }).toJSDate()
    assert.throws(
      () => WebhookManager.receive(events[2], JSON.stringify(events[2]), later),
      /No active receiver session/
    )
    expect(
      db
        .select()
        .from(webhookEvents)
        .where(
          and(
            eq(webhookEvents.capture, capture(events[0].game.gameId).id),
            eq(webhookEvents.sequence, 2)
          )
        )
        .get()
    ).toBeUndefined()
    expect(WebhookManager.findSession(later)).toBeUndefined()
  }
)

test.serial(
  'Best finishes come from persisted events and private payload extensions stay out of drafts',
  async () => {
    const c = await context('best-finish')
    const finish = c.events.find(event => event.type === 'finish')
    const end = c.events.at(-1)
    const start = c.events[0]
    assert(
      finish &&
        finish.type === 'finish' &&
        end &&
        end.type === 'end' &&
        start.type === 'start' &&
        start.map
    )
    const raw = JSON.stringify({
      ...start,
      map: { ...start.map, privateExtension: { accountId: 'private-account' } },
    })
    expect((await post(start, {}, raw)).status).toBe(204)
    expect(JSON.stringify(draft(c.gameId))).not.toContain('private-account')
    c.events = [
      ...c.events.slice(1, 6),
      { ...finish, eventId: randomUUID(), sequence: 6, durationMs: 26000 },
      { ...end, sequence: 7 },
    ]
    await replay(c.events)
    assertResponse(
      await WebhookManager.onCreateTrack(c.adminSocket, { gameId: c.gameId })
    )
    assertResponse(
      await WebhookManager.onClaim(c.socket, {
        gameId: c.gameId,
        playerIndex: 0,
      })
    )
    const id = capture(c.gameId).id
    db.update(timeEntries)
      .set({ duration: 99999, chugDurationMs: 99999 })
      .where(eq(timeEntries.webhookCapture, id))
      .run()
    assertResponse(
      await WebhookManager.onPublish(c.socket, { gameId: c.gameId })
    )
    const published = (await TimeEntryManager.getAllTimeEntries()).find(
      row => row.webhookCapture === id
    )
    assert(published)
    expect(published.duration).toBe(26000)
    expect(published.chugDurationMs).toBe(125)
    const audit = await WebhookManager.onGetEvents(c.socket, {
      gameId: c.gameId,
    })
    assertResponse(audit)
    expect(audit.events[0].rawPayload).toBe(raw)
  }
)

test.serial(
  'Session windows use Oslo calendar days across daylight saving changes',
  () => {
    for (const iso of ['2035-03-25T03:30:00Z', '2035-10-28T01:30:00Z']) {
      const now = DateTime.fromISO(iso, { zone: 'Europe/Oslo' })
      const yesterday = now.startOf('day').minus({ days: 1 })
      const previousId = randomUUID()
      const expiredId = randomUUID()
      db.insert(sessions)
        .values([
          {
            id: previousId,
            name: 'Yesterday across DST',
            date: yesterday.toJSDate(),
          },
          {
            id: expiredId,
            name: 'Before yesterday',
            date: yesterday.minus({ milliseconds: 1 }).toJSDate(),
          },
        ])
        .run()
      expect(WebhookManager.findSession(now.toJSDate(), previousId)?.id).toBe(
        previousId
      )
      expect(
        WebhookManager.findSession(now.toJSDate(), expiredId)
      ).toBeUndefined()
    }
  }
)
