import type {
  ResultDraftRequest,
  ResultDrafts,
} from '@common/models/resultDraft'
import type { EventReq, EventRes } from '@common/models/socket.io'
import type { UserInfo } from '@common/models/user'
import { isRecord } from '@common/utils/utils'
import { and, asc, desc, eq, gt, gte, isNull, lte, ne } from 'drizzle-orm'
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
import { isWebhookEvent, type WebhookDraft } from '../models/webhook'
import type { Event, Map, StartEvent } from '../models/webhook.generated'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import MatchManager from './match.manager'
import RatingManager from './rating.manager'
import SessionManager from './session.manager'
import TimeEntryManager from './timeEntry.manager'
import TournamentManager from './tournament/tournament.manager'
import TrackManager from './track.manager'

type PlayerTimes = {
  finishDurationMs: number | null
  chugDurationMs: number | null
}

type Capture = typeof webhookCaptures.$inferSelect

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
function resultRequest(
  request: unknown
): asserts request is ResultDraftRequest {
  if (
    !isRecord(request) ||
    typeof request.id !== 'string' ||
    (request.kind !== 'lap' && request.kind !== 'match')
  )
    fail('Invalid result draft request')
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

function mapMetadata(map: Map) {
  return {
    uid: map.uid,
    author: map.author,
    environment: map.environment,
    authorMedalMs: map.medalTimesMs.author,
    goldMedalMs: map.medalTimesMs.gold,
    silverMedalMs: map.medalTimesMs.silver,
    bronzeMedalMs: map.medalTimesMs.bronze,
    isLaps: map.isLaps,
    totalLaps: map.totalLaps ?? null,
    checkpointsPerLap: map.checkpointsPerLap,
  }
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

  private static events(capture: string): Event[] {
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

  static findNextSession(now = new Date()) {
    return db
      .select()
      .from(sessions)
      .where(
        and(
          isNull(sessions.deletedAt),
          ne(sessions.status, 'cancelled'),
          gt(sessions.date, now)
        )
      )
      .orderBy(asc(sessions.date), asc(sessions.id))
      .get()
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

  private static derivedTimes(events: Event[]): PlayerTimes[] | null {
    const start = events.find(
      (event): event is StartEvent => event.type === 'start'
    )
    if (!start) return null
    const end = events.find(event => event.type === 'end')
    return start.players.map(p => {
      const playerEvents = events.filter(
        event =>
          event.type !== 'start' &&
          event.type !== 'end' &&
          event.player.playerIndex === p.playerIndex &&
          (!end || event.sequence < end.sequence)
      )
      const finishes = playerEvents
        .filter(event => event.type === 'finish')
        .map(event => event.durationMs)
      return {
        finishDurationMs: finishes.length ? Math.min(...finishes) : null,
        chugDurationMs:
          playerEvents.find(event => event.type === 'first_throttle')
            ?.durationMs ?? null,
      }
    })
  }

  private static rows(capture: Capture) {
    return {
      lap: db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.webhookCapture, capture.id))
        .get(),
      match: db
        .select()
        .from(matches)
        .where(eq(matches.webhookCapture, capture.id))
        .get(),
    }
  }

  private static rowTimes(capture: Capture): PlayerTimes[] {
    const { lap, match } = this.rows(capture)
    if (capture.totalPlayers === 1)
      return [
        {
          finishDurationMs: lap?.duration ?? null,
          chugDurationMs: lap?.chugDurationMs ?? null,
        },
      ]
    return [
      {
        finishDurationMs: match?.user1DurationMs ?? null,
        chugDurationMs: match?.user1ChugDurationMs ?? null,
      },
      {
        finishDurationMs: match?.user2DurationMs ?? null,
        chugDurationMs: match?.user2ChugDurationMs ?? null,
      },
    ]
  }

  private static syncTimes(
    capture: Capture,
    before: PlayerTimes[] | null,
    after: PlayerTimes[]
  ): void {
    const times = this.rowTimes(capture).map((current, i) => {
      const keep = (key: keyof PlayerTimes) =>
        current[key] !== (before?.[i]?.[key] ?? null)
      return {
        finishDurationMs: keep('finishDurationMs')
          ? current.finishDurationMs
          : after[i].finishDurationMs,
        chugDurationMs: keep('chugDurationMs')
          ? current.chugDurationMs
          : after[i].chugDurationMs,
      }
    })
    if (capture.totalPlayers === 1)
      db.update(timeEntries)
        .set({
          duration: times[0].finishDurationMs,
          chugDurationMs: times[0].chugDurationMs,
        })
        .where(eq(timeEntries.webhookCapture, capture.id))
        .run()
    else
      db.update(matches)
        .set({
          user1DurationMs: times[0].finishDurationMs,
          user2DurationMs: times[1].finishDurationMs,
          user1ChugDurationMs: times[0].chugDurationMs,
          user2ChugDurationMs: times[1].chugDurationMs,
        })
        .where(eq(matches.webhookCapture, capture.id))
        .run()
  }

  private static draft(capture: Capture): WebhookDraft | null {
    const events = this.events(capture.id)
    const start = events.find(
      (event): event is StartEvent => event.type === 'start'
    )
    if (!start) return null
    const end = events.find(event => event.type === 'end')
    const { lap, match } = this.rows(capture)
    const times = this.rowTimes(capture)
    const players = start.players.map((p, i) => {
      let user: string | null = null
      if (capture.totalPlayers === 1) user = lap?.user ?? null
      else user = i === 0 ? (match?.user1 ?? null) : (match?.user2 ?? null)
      return { playerIndex: p.playerIndex, user, ...times[i] }
    })
    const trackId = lap?.track ?? match?.track ?? null
    const track = trackId
      ? db
          .select()
          .from(tracks)
          .where(and(eq(tracks.id, trackId), isNull(tracks.deletedAt)))
          .get()
      : undefined
    const blockers: string[] = []
    if (!end) blockers.push('Waiting for end event')
    if (
      end &&
      events.filter(event => event.sequence <= end.sequence).length !==
        end.sequence + 1
    )
      blockers.push('Missing webhook events')
    if (!track) blockers.push('Select a track')
    else if (start.map && track.uid && track.uid !== start.map.uid)
      blockers.push('Track belongs to another map')
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
    const session = db
      .select()
      .from(sessions)
      .where(eq(sessions.id, capture.session))
      .get()
    if (!session || session.deletedAt) blockers.push('Session was deleted')
    if (session?.status === 'cancelled') blockers.push('Session is cancelled')
    return {
      kind: players.length === 1 ? 'lap' : 'match',
      map: start.map,
      track: track ?? null,
      players,
      blockers,
    }
  }

  static getAllDrafts(session?: string): ResultDrafts {
    const captureFilter = and(
      session !== undefined ? eq(webhookCaptures.session, session) : undefined,
      isNull(webhookCaptures.deletedAt),
      isNull(webhookCaptures.publishedAt)
    )
    return {
      timeEntries: db
        .select({
          id: timeEntries.id,
          createdAt: timeEntries.createdAt,
          updatedAt: timeEntries.updatedAt,
          deletedAt: timeEntries.deletedAt,
          publicationState: timeEntries.publicationState,
          user: timeEntries.user,
          track: timeEntries.track,
          session: timeEntries.session,
          duration: timeEntries.duration,
          chugDurationMs: timeEntries.chugDurationMs,
          status: timeEntries.status,
          tieBreaker: timeEntries.tieBreaker,
          amount: timeEntries.amount,
          comment: timeEntries.comment,
        })
        .from(timeEntries)
        .innerJoin(
          webhookCaptures,
          eq(timeEntries.webhookCapture, webhookCaptures.id)
        )
        .where(
          and(
            captureFilter,
            eq(timeEntries.publicationState, 'draft'),
            isNull(timeEntries.deletedAt)
          )
        )
        .orderBy(asc(timeEntries.createdAt))
        .all(),
      matches: db
        .select({
          id: matches.id,
          createdAt: matches.createdAt,
          updatedAt: matches.updatedAt,
          deletedAt: matches.deletedAt,
          publicationState: matches.publicationState,
          user1: matches.user1,
          user2: matches.user2,
          track: matches.track,
          session: matches.session,
          duration: matches.duration,
          user1DurationMs: matches.user1DurationMs,
          user2DurationMs: matches.user2DurationMs,
          user1ChugDurationMs: matches.user1ChugDurationMs,
          user2ChugDurationMs: matches.user2ChugDurationMs,
          winner: matches.winner,
          stage: matches.stage,
          comment: matches.comment,
          status: matches.status,
        })
        .from(matches)
        .innerJoin(
          webhookCaptures,
          eq(matches.webhookCapture, webhookCaptures.id)
        )
        .where(
          and(
            captureFilter,
            eq(matches.publicationState, 'draft'),
            isNull(matches.deletedAt)
          )
        )
        .orderBy(asc(matches.createdAt))
        .all(),
    }
  }

  static publish(actor: string | null = null): void {
    broadcast('all_result_drafts', this.getAllDrafts(), actor)
  }

  static receive(event: Event, rawPayload: string, now = new Date()): string {
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
      return 'Duplicate ignored'
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
      existing && !existing.publishedAt
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
      const beforeTimes = this.derivedTimes(this.events(capture.id))
      const all = [...this.events(capture.id), event]
      const start = all.find((e): e is StartEvent => e.type === 'start')
      if (start) {
        for (const e of all) {
          if (e.type === 'start' || e.type === 'end') continue
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
      if (capture.publishedAt || !start) return
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
      const afterTimes = this.derivedTimes(this.events(capture.id))
      if (afterTimes) this.syncTimes(capture, beforeTimes, afterTimes)
    })()
    const saved = this.capture(event.game.gameId)
    const after = saved.publishedAt ? null : JSON.stringify(this.draft(saved))
    if (before !== after) this.publish()
    if (saved.publishedAt) return 'Stored; capture already published'
    if (after === 'null') return 'Stored; waiting for start'
    if (before === after) return 'Stored; draft unchanged'
    return before === null || before === 'null'
      ? 'Draft created'
      : 'Draft updated'
  }

  private static captureForResult(request: ResultDraftRequest): Capture {
    const table = request.kind === 'lap' ? timeEntries : matches
    const row = db
      .select({ capture: table.webhookCapture, deletedAt: table.deletedAt })
      .from(table)
      .where(eq(table.id, request.id))
      .get()
    if (!row?.capture) fail('Result draft not found')
    const capture = db
      .select()
      .from(webhookCaptures)
      .where(eq(webhookCaptures.id, row.capture))
      .get()
    if (!capture) fail('Result draft not found')
    if (row.deletedAt && !capture.publishedAt) fail('Result draft was deleted')
    return capture
  }

  private static canPublish(actor: UserInfo, draft: WebhookDraft): boolean {
    return actor.role !== 'user' || draft.players.some(p => p.user === actor.id)
  }

  static async onPublish(
    socket: TypedSocket,
    request: EventReq<'publish_result_draft'>
  ): Promise<EventRes<'publish_result_draft'>> {
    const actor = await AuthManager.checkAuth(socket)
    resultRequest(request)
    const changed = database.transaction(() => {
      const capture = this.captureForResult(request)
      const draft = this.draft(capture)
      if (!draft || !this.canPublish(actor, draft))
        fail('Insufficient permissions')
      if (capture.publishedAt) return false
      if (draft.blockers.length || !draft.track) fail(draft.blockers.join('; '))
      const participants = draft.players.map(p => p.user)
      if (
        draft.map &&
        !draft.track.uid &&
        !db.select().from(tracks).where(eq(tracks.uid, draft.map.uid)).get()
      )
        db.update(tracks)
          .set({ ...mapMetadata(draft.map), game: capture.sourceGame })
          .where(eq(tracks.id, draft.track.id))
          .run()
      if (draft.kind === 'lap')
        db.update(timeEntries)
          .set({ publicationState: 'published', status: 'completed' })
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
      return true
    })()
    if (changed) {
      RatingManager.recalculate()
      broadcast('all_sessions', await SessionManager.getAllSessions())
      broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
      broadcast('all_matches', await MatchManager.getAllMatches())
      broadcast('all_rankings', RatingManager.onGetRatings())
      broadcast('all_tracks', await TrackManager.getAllTracks())
      TournamentManager.publish(socket.id)
      this.publish(socket.id)
    }
    return { success: true }
  }
}
