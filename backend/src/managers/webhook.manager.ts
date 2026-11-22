import type { Track } from '@common/models/track'
import { getSessionQueue } from '@common/utils/activeEntry'
import { isRecord } from '@common/utils/utils'
import { DateTime } from 'luxon'
import MatchSource from '../../database/sources/match.source'
import SessionSource from '../../database/sources/session.source'
import TimeEntrySource from '../../database/sources/timeEntry.source'
import TrackSource from '../../database/sources/track.source'
import TransactionSource from '../../database/sources/transaction.source'
import WebhookSource, {
  type WebhookCapture,
} from '../../database/sources/webhook.source'
import { isWebhookEvent } from '../models/webhook'
import type { Event, Map, StartEvent } from '../models/webhook.generated'
import { broadcast } from '../server'
import ActiveEntryManager from './activeEntry.manager'
import ChugTimeManager from './chugtime.manager'
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

type Capture = WebhookCapture

type Rows = {
  lap: ReturnType<typeof TimeEntrySource.findByCapture>
  match: ReturnType<typeof MatchSource.findByCapture>
}

export class WebhookError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function trackLevelFromWebhook(level: unknown) {
  switch (level) {
    case 'white':
    case 'green':
    case 'blue':
    case 'red':
    case 'black':
    case 'custom':
      return level
    default:
      return 'custom'
  }
}

function trackMetadataFromWebhook(map: Map) {
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
    return SessionSource.findStartedWithin(now, yesterday, id)
  }

  private static events(capture: string): Event[] {
    return WebhookSource.getEvents(capture).map(row => {
      const value: unknown = JSON.parse(row.rawPayload)
      if (!isWebhookEvent(value))
        throw new Error('Invalid stored webhook event')
      return value
    })
  }

  private static derivedTimes(
    events: Event[],
    totalPlayers: number
  ): PlayerTimes[] {
    return Array.from({ length: totalPlayers }, (_, playerIndex) => {
      const playerEvents = events
        .filter(
          event =>
            event.type !== 'start' &&
            event.type !== 'end' &&
            event.player.playerIndex === playerIndex
        )
        .sort((a, b) => a.sequence - b.sequence)
      const finish = playerEvents.find(event => event.type === 'finish')
      return {
        finishDurationMs:
          finish?.durationMs ??
          (playerEvents.length
            ? Math.max(...playerEvents.map(event => event.durationMs))
            : null),
        chugDurationMs:
          playerEvents.find(event => event.type === 'first_throttle')
            ?.durationMs ?? null,
      }
    })
  }

  private static rows(capture: Capture): Rows {
    return {
      lap: TimeEntrySource.findByCapture(capture.id),
      match: MatchSource.findByCapture(capture.id),
    }
  }

  private static rowTimes(
    capture: Capture,
    { lap, match }: Rows
  ): PlayerTimes[] {
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

  private static hasPlayers({ lap, match }: Rows): boolean {
    return lap ? !!lap.user : !!match?.user1 && !!match.user2
  }

  private static latchActiveEntry(capture: Capture, track: string): boolean {
    const tournament =
      TournamentManager.getDetails(capture.session) ?? undefined
    const ready =
      tournament?.status === 'started' &&
      !tournament.cancelled &&
      !tournament.notReadyReason
        ? tournament
        : undefined
    const { now } = getSessionQueue(
      capture.session,
      [
        ...MatchSource.getStandaloneBySession(capture.session),
        ...(ready?.matches ?? []),
      ],
      TimeEntrySource.getAllBySession(capture.session),
      ready,
      ActiveEntryManager.getOverrides()[capture.session]
    )
    if (
      !now ||
      now.entry.status !== 'planned' ||
      now.entry.webhookCapture ||
      now.entry.track !== track
    )
      return false
    if (now.kind === 'timeEntry') {
      const { user, tieBreaker, id } = now.entry
      if (
        capture.totalPlayers !== 1 ||
        !user ||
        (tieBreaker && !ready?.tieBreakers.some(lap => lap.id === id))
      )
        return false
    } else {
      const { user1, user2, tournament } = now.entry
      if (
        capture.totalPlayers !== 2 ||
        !user1 ||
        !user2 ||
        tournament?.readOnly
      )
        return false
    }
    const updates = {
      webhookCapture: capture.id,
      status: 'in_progress',
    } satisfies Pick<typeof now.entry, 'webhookCapture' | 'status'>
    if (now.kind === 'timeEntry') TimeEntrySource.update(now.entry.id, updates)
    else MatchSource.update(now.entry.id, updates)
    return true
  }

  private static completePlanned(
    capture: Capture,
    track: string,
    events: Event[]
  ): { signupChanged: boolean } | undefined {
    const start = events.at(0)
    const last = events.at(-1)
    if (
      start?.type !== 'start' ||
      !last ||
      events.length !== last.sequence - start.sequence + 1
    )
      return
    const rows = this.rows(capture)
    if (!this.hasPlayers(rows)) return
    const finished = Array.from({ length: capture.totalPlayers }, (_, index) =>
      events.some(
        event =>
          event.type === 'finish' &&
          event.player.playerIndex === index &&
          event.durationMs > 0
      )
    )
    if (!finished.every(Boolean) && last.type !== 'end') return
    const { lap, match } = rows
    const result = lap ?? match
    if (result?.session !== capture.session || result.track !== track) return

    try {
      return TransactionSource.run(() => {
        if (lap) {
          if (lap.tieBreaker) {
            const tournament = TournamentManager.getDetails(capture.session)
            if (
              tournament?.status !== 'started' ||
              tournament.cancelled ||
              tournament.notReadyReason
            )
              return
          }
          return {
            signupChanged: TimeEntryManager.saveTimeEntryEdit(lap, {
              status: 'completed',
              duration: finished[0] ? lap.duration : null,
            }),
          }
        }
        if (!match) return
        const request = MatchManager.inferWebhookResult(
          {
            type: 'EditMatchRequest',
            id: match.id,
            status: 'completed',
            user1DurationMs: finished[0] ? match.user1DurationMs : null,
            user2DurationMs: finished[1] ? match.user2DurationMs : null,
          },
          match
        )
        if (!TournamentManager.editMatch(request))
          MatchSource.update(match.id, {
            status: 'completed',
            winner: request.winner,
            duration: request.duration,
            user1DurationMs: request.user1DurationMs,
            user2DurationMs: request.user2DurationMs,
          })
        return { signupChanged: false }
      })
    } catch (error) {
      console.error(error)
    }
  }

  private static syncTimes(
    capture: Capture,
    before: PlayerTimes[],
    after: PlayerTimes[],
    events: Event[]
  ): void {
    const rows = this.rows(capture)
    const { lap, match } = rows
    const doneOn = this.hasPlayers(rows) ? 'end' : 'finish'
    const status =
      (lap ?? match)?.status === 'draft' ||
      events.some(event => event.type === doneOn)
        ? 'draft'
        : 'in_progress'
    const times = this.rowTimes(capture, rows).map((current, i) => {
      const keep = (key: keyof PlayerTimes) => current[key] !== before[i][key]
      return {
        finishDurationMs: keep('finishDurationMs')
          ? current.finishDurationMs
          : after[i].finishDurationMs,
        chugDurationMs: keep('chugDurationMs')
          ? current.chugDurationMs
          : after[i].chugDurationMs,
      }
    })
    if (
      lap &&
      lap.status === status &&
      lap.duration === times[0].finishDurationMs &&
      lap.chugDurationMs === times[0].chugDurationMs
    )
      return
    if (
      match &&
      match.status === status &&
      match.user1DurationMs === times[0].finishDurationMs &&
      match.user2DurationMs === times[1].finishDurationMs &&
      match.user1ChugDurationMs === times[0].chugDurationMs &&
      match.user2ChugDurationMs === times[1].chugDurationMs
    )
      return
    if (lap)
      TimeEntrySource.update(lap.id, {
        status,
        duration: times[0].finishDurationMs,
        chugDurationMs: times[0].chugDurationMs,
      })
    else if (match)
      MatchSource.update(match.id, {
        status,
        user1DurationMs: times[0].finishDurationMs,
        user2DurationMs: times[1].finishDurationMs,
        user1ChugDurationMs: times[0].chugDurationMs,
        user2ChugDurationMs: times[1].chugDurationMs,
      })
  }

  private static publishEntries(): void {
    void Promise.all([
      TimeEntryManager.getAllTimeEntries(),
      MatchManager.getAllMatches(),
    ]).then(([entries, matchRows]) => {
      broadcast('all_time_entries', entries)
      broadcast('all_matches', matchRows)
    })
    void ChugTimeManager.publish()
  }

  static receive(event: Event, rawPayload: string, now = new Date()): string {
    if (event.game.totalPlayers !== 1 && event.game.totalPlayers !== 2)
      throw new WebhookError(
        400,
        'UNSUPPORTED_PLAYER_COUNT',
        'Only one or two players are supported'
      )
    if (
      event.type === 'start' &&
      (!Array.isArray(event.players) ||
        event.players.length !== event.game.totalPlayers ||
        !event.players.every(
          (player: unknown, index: number) =>
            isRecord(player) && player.playerIndex === index
        ))
    )
      throw new WebhookError(
        400,
        'INVALID_ROSTER',
        'Start players must match the game player count and indexes'
      )
    if (
      event.type !== 'start' &&
      event.type !== 'end' &&
      (!Number.isInteger(event.player.playerIndex) ||
        event.player.playerIndex < 0 ||
        event.player.playerIndex >= event.game.totalPlayers)
    )
      throw new WebhookError(400, 'INVALID_PLAYER', 'Invalid player index')
    const outcome = TransactionSource.run(() => {
      let createdTrack: Track | undefined
      const existingEvent = WebhookSource.findEvent(event.eventId)
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
        return { duplicate: true }
      }
      const existing = WebhookSource.findCapture(event.game.gameId)
      const session = this.findSession(now, existing?.session)
      if (!session)
        throw new WebhookError(
          503,
          'NO_ACTIVE_SESSION',
          'No active receiver session can register this event'
        )
      const capture =
        existing ??
        WebhookSource.createCapture({
          id: event.game.gameId,
          gameId: event.game.gameId,
          session: session.id,
          totalPlayers: event.game.totalPlayers,
          sourceGame: event.source.game,
          pluginName: event.source.pluginName,
          pluginVersion: event.source.pluginVersion,
          createdAt: now,
        })
      if (
        capture.totalPlayers !== event.game.totalPlayers ||
        capture.sourceGame !== event.source.game ||
        capture.pluginName !== event.source.pluginName ||
        capture.pluginVersion !== event.source.pluginVersion
      )
        throw new WebhookError(409, 'GAME_CONFLICT', 'Game metadata changed')
      if (WebhookSource.hasSequence(capture.id, event.sequence))
        throw new WebhookError(
          409,
          'SEQUENCE_CONFLICT',
          'Sequence already belongs to another event'
        )
      const previous = this.events(capture.id)
      const beforeTimes = this.derivedTimes(previous, capture.totalPlayers)
      const all = [...previous, event].toSorted(
        (a, b) => a.sequence - b.sequence
      )
      const start = all.find((e): e is StartEvent => e.type === 'start')
      if (event.type === 'start' && previous.some(e => e.type === 'start'))
        throw new WebhookError(409, 'START_CONFLICT', 'Game already started')
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
      WebhookSource.createEvent({
        eventId: event.eventId,
        capture: capture.id,
        sequence: event.sequence,
        type: event.type,
        occurredAt: new Date(event.occurredAt),
        rawPayload,
        createdAt: now,
      })
      if (event.type === 'end')
        WebhookSource.markEnded(capture.id, new Date(event.occurredAt))
      const hasTiming = all.some(e => e.type !== 'start' && e.type !== 'end')
      let existingRows = this.rows(capture)
      const result = existingRows.lap ?? existingRows.match
      if (
        result?.deletedAt ||
        result?.status === 'completed' ||
        result?.status === 'cancelled'
      )
        return {}

      let matchedTrack = start?.map
        ? TrackSource.findByUid(start.map.uid)
        : undefined
      if (
        event.type === 'start' &&
        !result &&
        matchedTrack &&
        this.latchActiveEntry(capture, matchedTrack.id)
      )
        existingRows = this.rows(capture)
      const latched = this.hasPlayers(existingRows)
      if (!latched && (!hasTiming || event.type === 'end')) return {}
      if (start?.map && !matchedTrack) {
        matchedTrack = TrackSource.create({
          ...trackMetadataFromWebhook(start.map),
          name: start.map.name,
          mapType: start.map.type,
          level: trackLevelFromWebhook(start.map.level),
          game: capture.sourceGame,
          platform: 'pc',
        })
        createdTrack = matchedTrack
      }
      if (matchedTrack && existingRows.lap && !existingRows.lap.track)
        TimeEntrySource.update(existingRows.lap.id, { track: matchedTrack.id })
      if (matchedTrack && existingRows.match && !existingRows.match.track)
        MatchSource.update(existingRows.match.id, { track: matchedTrack.id })
      if (capture.totalPlayers === 1 && !existingRows.lap)
        TimeEntrySource.create({
          webhookCapture: capture.id,
          session: capture.session,
          track: matchedTrack?.id,
          status: 'in_progress',
          createdAt: now,
        })
      if (capture.totalPlayers === 2 && !existingRows.match)
        MatchSource.create({
          webhookCapture: capture.id,
          session: capture.session,
          track: matchedTrack?.id,
          status: 'in_progress',
          createdAt: now,
        })
      const afterTimes = this.derivedTimes(all, capture.totalPlayers)
      this.syncTimes(capture, beforeTimes, afterTimes, all)
      const completed =
        matchedTrack && this.completePlanned(capture, matchedTrack.id, all)
      return { createdTrack, completed, latched }
    }, true)
    if (outcome.duplicate) return 'Duplicate ignored'
    const { createdTrack, completed } = outcome
    if (createdTrack) {
      void TrackManager.getAllTracks().then(all => broadcast('all_tracks', all))
      TrackManager.resolveNextMapId(createdTrack).catch(console.error)
    }
    if (completed) {
      RatingManager.recalculate()
      broadcast('all_rankings', RatingManager.onGetRatings())
      if (completed.signupChanged)
        void SessionManager.getAllSessions().then(rows =>
          broadcast('all_sessions', rows)
        )
    }
    if (outcome.latched) TournamentManager.publish()
    this.publishEntries()
    return 'Stored'
  }
}
