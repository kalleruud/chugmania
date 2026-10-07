import type { EventReq, EventRes } from '@common/models/socket.io'
import type { UserInfo } from '@common/models/user'
import {
  isWebhookEvent,
  type WebhookDraft,
  type WebhookDrafts,
  type WebhookEvent,
  type WebhookGameRequest,
} from '@common/models/webhook'
import { isRecord } from '@common/utils/utils'
import { and, asc, desc, eq, gte, isNull, lt, lte, ne } from 'drizzle-orm'
import { DateTime } from 'luxon'
import db, { database } from '../../database/database'
import {
  matches,
  sessions,
  timeEntries,
  tracks,
  users,
  webhookCaptures,
  webhookEvents,
} from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import MatchManager from './match.manager'
import RatingManager from './rating.manager'
import SessionManager from './session.manager'
import TimeEntryManager from './timeEntry.manager'
import TournamentManager from './tournament/tournament.manager'

type Capture = typeof webhookCaptures.$inferSelect
type Start = Extract<WebhookEvent, { type: 'start' }>

export class WebhookError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function fail(message: string): never {
  throw new Error(message)
}
function gameRequest(request: unknown): asserts request is WebhookGameRequest {
  if (!isRecord(request) || typeof request.gameId !== 'string')
    fail('Invalid webhook request')
}
function activeUser(id: string | null): boolean {
  return (
    id !== null &&
    !!db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .get()
  )
}

export default class WebhookManager {
  static findSession(now = new Date(), id?: string) {
    const yesterday = DateTime.fromJSDate(now, { zone: 'Europe/Oslo' })
      .startOf('day')
      .minus({ days: 1 })
      .toJSDate()
    return db
      .select()
      .from(sessions)
      .where(
        and(
          isNull(sessions.deletedAt),
          ne(sessions.status, 'cancelled'),
          lte(sessions.date, now),
          gte(sessions.date, yesterday),
          id ? eq(sessions.id, id) : undefined
        )
      )
      .orderBy(desc(sessions.date), asc(sessions.id))
      .get()
  }

  static events(capture: string): WebhookEvent[] {
    return db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.capture, capture))
      .orderBy(asc(webhookEvents.sequence))
      .all()
      .map(row => {
        const value: unknown = JSON.parse(row.rawPayload)
        if (!isWebhookEvent(value)) fail('Invalid stored webhook event')
        return value
      })
  }

  private static capture(gameId: string): Capture {
    const capture = db
      .select()
      .from(webhookCaptures)
      .where(eq(webhookCaptures.gameId, gameId))
      .get()
    if (!capture) fail('Webhook capture not found')
    return capture
  }

  private static draft(capture: Capture): WebhookDraft | null {
    const events = this.events(capture.id)
    const start = events.find((event): event is Start => event.type === 'start')
    if (!start) return null
    const end = events.find(event => event.type === 'end')
    const lap = db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.webhookCapture, capture.id))
      .get()
    const match = db
      .select()
      .from(matches)
      .where(eq(matches.webhookCapture, capture.id))
      .get()
    const players = start.players.map(p => {
      const playerEvents = events.filter(
        event =>
          'player' in event &&
          event.player.playerIndex === p.playerIndex &&
          (!end || event.sequence < end.sequence)
      )
      const finishes = playerEvents
        .filter(event => event.type === 'finish')
        .map(event => event.durationMs)
      const throttle = playerEvents.find(
        event => event.type === 'first_throttle'
      )
      let user: string | null = null
      if (start.game.totalPlayers === 1) user = lap?.user ?? null
      else
        user =
          p.playerIndex === 0 ? (match?.user1 ?? null) : (match?.user2 ?? null)
      return {
        playerIndex: p.playerIndex,
        name: p.name ?? `Player ${p.playerIndex + 1}`,
        user,
        finishDurationMs: finishes.length ? Math.min(...finishes) : null,
        chugDurationMs: throttle?.durationMs ?? null,
      }
    })
    const track = lap?.track ?? match?.track ?? null
    const blockers: string[] = []
    if (!end) blockers.push('Waiting for end event')
    if (
      end &&
      events.filter(event => event.sequence <= end.sequence).length !==
        end.sequence + 1
    )
      blockers.push('Missing webhook events')
    if (
      !track ||
      !db
        .select({ id: tracks.id })
        .from(tracks)
        .where(and(eq(tracks.id, track), isNull(tracks.deletedAt)))
        .get()
    )
      blockers.push('Select a track')
    if (players.some(p => !activeUser(p.user)))
      blockers.push('Assign every player')
    if (
      players.length === 2 &&
      players[0].user &&
      players[0].user === players[1].user
    )
      blockers.push('Players must be different users')
    const finishers = players.filter(p => (p.finishDurationMs ?? 0) > 0)
    if (!finishers.length || players.some(p => p.finishDurationMs === 0))
      blockers.push('No valid finish result')
    if (
      players.length === 2 &&
      players[0].finishDurationMs !== null &&
      players[0].finishDurationMs === players[1].finishDurationMs
    )
      blockers.push('Finish times are tied')
    if (
      !db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(eq(sessions.id, capture.session), isNull(sessions.deletedAt))
        )
        .get()
    )
      blockers.push('Session was deleted')
    const session = db
      .select()
      .from(sessions)
      .where(eq(sessions.id, capture.session))
      .get()
    if (session?.status === 'cancelled') blockers.push('Session is cancelled')
    return {
      gameId: capture.gameId,
      session: capture.session,
      kind: players.length === 1 ? 'lap' : 'match',
      map: start.map
        ? {
            uid: start.map.uid,
            name: start.map.name,
            author: start.map.author,
            environment: start.map.environment,
            type: start.map.type,
            medalTimesMs: {
              author: start.map.medalTimesMs.author,
              gold: start.map.medalTimesMs.gold,
              silver: start.map.medalTimesMs.silver,
              bronze: start.map.medalTimesMs.bronze,
            },
            isLaps: start.map.isLaps,
            totalLaps: start.map.totalLaps,
            checkpointsPerLap: start.map.checkpointsPerLap,
          }
        : null,
      track,
      players,
      endReason: end?.type === 'end' ? end.endReason : null,
      blockers,
    }
  }

  static getDrafts(session: string): WebhookDrafts {
    const captures = db
      .select()
      .from(webhookCaptures)
      .where(
        and(
          eq(webhookCaptures.session, session),
          isNull(webhookCaptures.deletedAt),
          isNull(webhookCaptures.publishedAt)
        )
      )
      .orderBy(asc(webhookCaptures.createdAt))
      .all()
    return {
      session,
      drafts: captures.flatMap(capture => {
        const draft = this.draft(capture)
        return draft ? [draft] : []
      }),
    }
  }

  static notify(session: string, actor: string | null = null): void {
    broadcast('webhook_drafts_changed', this.getDrafts(session), actor)
  }

  static receive(
    event: WebhookEvent,
    rawPayload: string,
    now = new Date()
  ): void {
    const existingEvent = db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.eventId))
      .get()
    if (existingEvent) {
      if (
        JSON.stringify(JSON.parse(existingEvent.rawPayload)) !==
        JSON.stringify(JSON.parse(rawPayload))
      )
        throw new WebhookError(
          409,
          'EVENT_CONFLICT',
          'Event ID already has a different payload'
        )
      return
    }
    const existing = db
      .select()
      .from(webhookCaptures)
      .where(eq(webhookCaptures.gameId, event.game.gameId))
      .get()
    const session = this.findSession(now, existing?.session)
    if (!session)
      throw new WebhookError(
        503,
        'NO_ACTIVE_SESSION',
        'No active receiver session can register this event'
      )
    const before =
      existing && !existing.deletedAt && !existing.publishedAt
        ? JSON.stringify(this.draft(existing))
        : null
    database.transaction(() => {
      const capture =
        existing ??
        db
          .insert(webhookCaptures)
          .values({
            id: event.game.gameId,
            gameId: event.game.gameId,
            session: session.id,
            totalPlayers: event.game.totalPlayers,
            sourceGame: event.source.game,
            pluginName: event.source.pluginName,
            pluginVersion: event.source.pluginVersion,
            createdAt: now,
          })
          .returning()
          .get()
      if (
        capture.totalPlayers !== event.game.totalPlayers ||
        capture.sourceGame !== event.source.game ||
        capture.pluginName !== event.source.pluginName ||
        capture.pluginVersion !== event.source.pluginVersion
      )
        throw new WebhookError(409, 'GAME_CONFLICT', 'Game metadata changed')
      if (
        db
          .select()
          .from(webhookEvents)
          .where(
            and(
              eq(webhookEvents.capture, capture.id),
              eq(webhookEvents.sequence, event.sequence)
            )
          )
          .get()
      )
        throw new WebhookError(
          409,
          'SEQUENCE_CONFLICT',
          'Sequence already belongs to another event'
        )
      const all = [...this.events(capture.id), event]
      const start = all.find((e): e is Start => e.type === 'start')
      if (start) {
        for (const e of all) {
          if (!('player' in e)) continue
          const expected = start.players.at(e.player.playerIndex)
          if (
            !expected ||
            ['name', 'login', 'localId', 'accountId'].some(
              key =>
                Reflect.get(e.player, key) !== undefined &&
                Reflect.get(e.player, key) !== Reflect.get(expected, key)
            )
          )
            throw new WebhookError(
              409,
              'PLAYER_CONFLICT',
              'Player does not match the start roster'
            )
        }
      }
      if (event.type === 'end' && all.filter(e => e.type === 'end').length > 1)
        throw new WebhookError(409, 'END_CONFLICT', 'Game already ended')
      db.insert(webhookEvents)
        .values({
          eventId: event.eventId,
          capture: capture.id,
          sequence: event.sequence,
          type: event.type,
          occurredAt: new Date(event.occurredAt),
          rawPayload,
          createdAt: now,
        })
        .run()
      if (event.type === 'end')
        db.update(webhookCaptures)
          .set({ endedAt: new Date(event.occurredAt) })
          .where(eq(webhookCaptures.id, capture.id))
          .run()
      if (capture.deletedAt || capture.publishedAt || !start) return
      const matchedTrack = start.map
        ? db
            .select()
            .from(tracks)
            .where(and(eq(tracks.uid, start.map.uid), isNull(tracks.deletedAt)))
            .get()
        : undefined
      if (
        capture.totalPlayers === 1 &&
        !db
          .select()
          .from(timeEntries)
          .where(eq(timeEntries.webhookCapture, capture.id))
          .get()
      )
        db.insert(timeEntries)
          .values({
            webhookCapture: capture.id,
            publicationState: 'draft',
            session: capture.session,
            track: matchedTrack?.id,
            status: 'planned',
            createdAt: now,
          })
          .run()
      if (
        capture.totalPlayers === 2 &&
        !db
          .select()
          .from(matches)
          .where(eq(matches.webhookCapture, capture.id))
          .get()
      )
        db.insert(matches)
          .values({
            webhookCapture: capture.id,
            publicationState: 'draft',
            session: capture.session,
            track: matchedTrack?.id,
            status: 'planned',
            createdAt: now,
          })
          .run()
      const draft = this.draft(capture)
      if (!draft) return
      if (draft.kind === 'lap')
        db.update(timeEntries)
          .set({
            duration: draft.players[0].finishDurationMs,
            chugDurationMs: draft.players[0].chugDurationMs,
          })
          .where(eq(timeEntries.webhookCapture, capture.id))
          .run()
      else
        db.update(matches)
          .set({
            user1DurationMs: draft.players[0].finishDurationMs,
            user2DurationMs: draft.players[1].finishDurationMs,
            user1ChugDurationMs: draft.players[0].chugDurationMs,
            user2ChugDurationMs: draft.players[1].chugDurationMs,
          })
          .where(eq(matches.webhookCapture, capture.id))
          .run()
    })()
    const saved = this.capture(event.game.gameId)
    const after =
      !saved.deletedAt && !saved.publishedAt
        ? JSON.stringify(this.draft(saved))
        : null
    if (before !== after) this.notify(session.id)
  }

  private static editable(gameId: string): {
    capture: Capture
    draft: WebhookDraft
  } {
    const capture = this.capture(gameId)
    if (capture.deletedAt || capture.publishedAt)
      fail('Capture is no longer a draft')
    const draft = this.draft(capture)
    if (!draft) fail('Capture has no start event')
    return { capture, draft }
  }

  static async onGetDrafts(
    socket: TypedSocket,
    request: EventReq<'get_webhook_drafts'>
  ): Promise<EventRes<'get_webhook_drafts'>> {
    await AuthManager.checkAuth(socket)
    if (!isRecord(request) || typeof request.session !== 'string')
      fail('Invalid session request')
    return { success: true, ...this.getDrafts(request.session) }
  }

  private static assign(
    capture: Capture,
    draft: WebhookDraft,
    index: number,
    user: string | null
  ): void {
    if (!Number.isInteger(index) || index < 0 || index >= draft.players.length)
      fail('Invalid player index')
    if (user !== null && !activeUser(user)) fail('User not found')
    if (
      user &&
      draft.players.some(p => p.playerIndex !== index && p.user === user)
    )
      fail('User already occupies another slot')
    if (draft.kind === 'lap')
      db.update(timeEntries)
        .set({ user })
        .where(eq(timeEntries.webhookCapture, capture.id))
        .run()
    else
      db.update(matches)
        .set(index === 0 ? { user1: user } : { user2: user })
        .where(eq(matches.webhookCapture, capture.id))
        .run()
  }

  static async onClaim(
    socket: TypedSocket,
    request: EventReq<'claim_webhook_player'>
  ): Promise<EventRes<'claim_webhook_player'>> {
    const actor = await AuthManager.checkAuth(socket)
    gameRequest(request)
    if (
      !Number.isInteger(request.playerIndex) ||
      (request.release !== undefined && typeof request.release !== 'boolean')
    )
      fail('Invalid claim request')
    const session = database.transaction(() => {
      const { capture, draft } = this.editable(request.gameId)
      const slot = draft.players.find(
        p => p.playerIndex === request.playerIndex
      )
      if (
        !slot ||
        (slot.user && slot.user !== actor.id) ||
        (request.release && slot.user !== actor.id)
      )
        fail('Participant slot is not yours')
      this.assign(
        capture,
        draft,
        request.playerIndex,
        request.release ? null : actor.id
      )
      return capture.session
    })()
    this.notify(session, socket.id)
    return { success: true }
  }

  static async onAssign(
    socket: TypedSocket,
    request: EventReq<'assign_webhook_player'>
  ): Promise<EventRes<'assign_webhook_player'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    gameRequest(request)
    if (request.user !== null && typeof request.user !== 'string')
      fail('Invalid user')
    const session = database.transaction(() => {
      const { capture, draft } = this.editable(request.gameId)
      this.assign(capture, draft, request.playerIndex, request.user)
      return capture.session
    })()
    this.notify(session, socket.id)
    return { success: true }
  }

  static async onSelectTrack(
    socket: TypedSocket,
    request: EventReq<'select_webhook_track'>
  ): Promise<EventRes<'select_webhook_track'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    gameRequest(request)
    if (typeof request.track !== 'string') fail('Invalid track')
    const session = database.transaction(() => {
      const { capture, draft } = this.editable(request.gameId)
      const track = db
        .select()
        .from(tracks)
        .where(and(eq(tracks.id, request.track), isNull(tracks.deletedAt)))
        .get()
      if (!track) fail('Track not found')
      this.setTrack(capture, draft, track.id)
      return capture.session
    })()
    this.notify(session, socket.id)
    return { success: true }
  }

  private static setTrack(
    capture: Capture,
    draft: WebhookDraft,
    track: string
  ): void {
    if (draft.kind === 'lap')
      db.update(timeEntries)
        .set({ track })
        .where(eq(timeEntries.webhookCapture, capture.id))
        .run()
    else
      db.update(matches)
        .set({ track })
        .where(eq(matches.webhookCapture, capture.id))
        .run()
  }

  static async onCreateTrack(
    socket: TypedSocket,
    request: EventReq<'create_webhook_track'>
  ): Promise<EventRes<'create_webhook_track'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    gameRequest(request)
    const session = database.transaction(() => {
      const { capture, draft } = this.editable(request.gameId)
      const map = draft.map
      if (!map) fail('Capture has no map; select a track manually')
      let track = db.select().from(tracks).where(eq(tracks.uid, map.uid)).get()
      if (track?.deletedAt) fail('Map UID belongs to a deleted track')
      track ??= db
        .insert(tracks)
        .values({
          uid: map.uid,
          name: map.name,
          author: map.author,
          environment: map.environment,
          mapType: map.type,
          authorMedalMs: map.medalTimesMs.author,
          goldMedalMs: map.medalTimesMs.gold,
          silverMedalMs: map.medalTimesMs.silver,
          bronzeMedalMs: map.medalTimesMs.bronze,
          isLaps: map.isLaps,
          totalLaps: map.totalLaps,
          checkpointsPerLap: map.checkpointsPerLap,
          level: 'custom',
        })
        .returning()
        .get()
      this.setTrack(capture, draft, track.id)
      return capture.session
    })()
    const { default: TrackManager } = await import('./track.manager')
    broadcast('all_tracks', await TrackManager.getAllTracks())
    this.notify(session, socket.id)
    return { success: true }
  }

  private static canPublish(actor: UserInfo, draft: WebhookDraft): boolean {
    return actor.role !== 'user' || draft.players.some(p => p.user === actor.id)
  }

  static async onPublish(
    socket: TypedSocket,
    request: EventReq<'publish_webhook_draft'>
  ): Promise<EventRes<'publish_webhook_draft'>> {
    const actor = await AuthManager.checkAuth(socket)
    gameRequest(request)
    const result = database.transaction(() => {
      const capture = this.capture(request.gameId)
      const draft = this.draft(capture)
      if (!draft || !this.canPublish(actor, draft))
        fail('Insufficient permissions')
      if (capture.publishedAt)
        return { changed: false, session: capture.session }
      if (capture.deletedAt) fail('Capture was discarded')
      if (draft.blockers.length) fail(draft.blockers.join('; '))
      const participants = draft.players.map(p => p.user)
      if (draft.kind === 'lap')
        db.update(timeEntries)
          .set({
            publicationState: 'published',
            status: 'completed',
            duration: draft.players[0].finishDurationMs,
            chugDurationMs: draft.players[0].chugDurationMs,
          })
          .where(eq(timeEntries.webhookCapture, capture.id))
          .run()
      else {
        const winner = draft.players.toSorted(
          (a, b) =>
            (a.finishDurationMs ?? Infinity) - (b.finishDurationMs ?? Infinity)
        )[0]
        db.update(matches)
          .set({
            publicationState: 'published',
            status: 'completed',
            winner: winner.user,
            duration: winner.finishDurationMs,
            user1DurationMs: draft.players[0].finishDurationMs,
            user2DurationMs: draft.players[1].finishDurationMs,
            user1ChugDurationMs: draft.players[0].chugDurationMs,
            user2ChugDurationMs: draft.players[1].chugDurationMs,
          })
          .where(eq(matches.webhookCapture, capture.id))
          .run()
      }
      db.update(webhookCaptures)
        .set({ publishedAt: new Date() })
        .where(eq(webhookCaptures.id, capture.id))
        .run()
      for (const user of participants) {
        if (user) SessionManager.ensureSessionSignup(capture.session, user)
      }
      return { changed: true, session: capture.session }
    })()
    if (result.changed) {
      RatingManager.recalculate()
      broadcast('all_sessions', await SessionManager.getAllSessions())
      broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
      broadcast('all_matches', await MatchManager.getAllMatches())
      broadcast('all_rankings', RatingManager.onGetRatings())
      TournamentManager.publish(socket.id)
      this.notify(result.session, socket.id)
    }
    return { success: true }
  }

  static async onDiscard(
    socket: TypedSocket,
    request: EventReq<'discard_webhook_draft'>
  ): Promise<EventRes<'discard_webhook_draft'>> {
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    gameRequest(request)
    const session = database.transaction(() => {
      const capture = this.capture(request.gameId)
      if (capture.publishedAt) fail('Published captures cannot be discarded')
      const deletedAt = new Date()
      db.update(webhookCaptures)
        .set({ deletedAt })
        .where(eq(webhookCaptures.id, capture.id))
        .run()
      db.update(timeEntries)
        .set({ deletedAt })
        .where(eq(timeEntries.webhookCapture, capture.id))
        .run()
      db.update(matches)
        .set({ deletedAt })
        .where(eq(matches.webhookCapture, capture.id))
        .run()
      return capture.session
    })()
    this.notify(session, socket.id)
    return { success: true }
  }

  static async onGetEvents(
    socket: TypedSocket,
    request: EventReq<'get_webhook_events'>
  ): Promise<EventRes<'get_webhook_events'>> {
    const actor = await AuthManager.checkAuth(socket)
    gameRequest(request)
    const capture = this.capture(request.gameId)
    if (actor.role === 'user') {
      const lap = db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.webhookCapture, capture.id))
        .get()
      const match = db
        .select()
        .from(matches)
        .where(eq(matches.webhookCapture, capture.id))
        .get()
      if (
        lap?.user !== actor.id &&
        match?.user1 !== actor.id &&
        match?.user2 !== actor.id
      )
        fail('Insufficient permissions')
    }
    const events = db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.capture, capture.id))
      .orderBy(asc(webhookEvents.sequence))
      .all()
      .map(row => ({
        eventId: row.eventId,
        sequence: row.sequence,
        rawPayload: row.rawPayload,
      }))
    return { success: true, gameId: capture.gameId, events }
  }

  static prune(now = new Date()): void {
    const days = Number(process.env.WEBHOOK_DRAFT_RETENTION_DAYS ?? 7)
    if (!Number.isFinite(days) || days <= 0)
      fail('WEBHOOK_DRAFT_RETENTION_DAYS must be positive')
    const cutoff = new Date(now.getTime() - days * 86_400_000)
    const affected = new Set<string>()
    database.transaction(() => {
      const stale = db
        .select()
        .from(webhookCaptures)
        .where(
          and(
            isNull(webhookCaptures.publishedAt),
            lt(webhookCaptures.createdAt, cutoff)
          )
        )
        .all()
      for (const capture of stale) {
        affected.add(capture.session)
        db.delete(timeEntries)
          .where(eq(timeEntries.webhookCapture, capture.id))
          .run()
        db.delete(matches).where(eq(matches.webhookCapture, capture.id)).run()
        db.delete(webhookEvents)
          .where(eq(webhookEvents.capture, capture.id))
          .run()
        db.delete(webhookCaptures)
          .where(eq(webhookCaptures.id, capture.id))
          .run()
      }
    })()
    for (const session of affected) this.notify(session)
  }

  static startCleanup(): NodeJS.Timeout {
    this.prune()
    const timer = setInterval(() => {
      try {
        this.prune()
      } catch {
        console.error('Webhook cleanup failed')
      }
    }, 3_600_000)
    timer.unref()
    return timer
  }
}
