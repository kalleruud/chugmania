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
import MatchManager from './match.manager'
import TimeEntryManager from './timeEntry.manager'
import TrackManager from './track.manager'

type PlayerTimes = {
  finishDurationMs: number | null
  chugDurationMs: number | null
}

type Capture = WebhookCapture

export class WebhookError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
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

  static findNextSession(now = new Date()) {
    return SessionSource.findNext(now)
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
      lap: TimeEntrySource.findByCapture(capture.id),
      match: MatchSource.findByCapture(capture.id),
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
    const events = this.events(capture.id)
    const status = events.some(
      event => event.type === 'finish' || event.type === 'end'
    )
      ? 'draft'
      : 'in_progress'
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
    const { lap, match } = this.rows(capture)
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
  }

  static receive(event: Event, rawPayload: string, now = new Date()): string {
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
      return 'Duplicate ignored'
    }
    const existing = WebhookSource.findCapture(event.game.gameId)
    const session = this.findSession(now, existing?.session)
    if (!session)
      throw new WebhookError(
        503,
        'NO_ACTIVE_SESSION',
        'No active receiver session can register this event'
      )
    const createdTrack = TransactionSource.run(() => {
      let trackCreated = false
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
      const existingRows = this.rows(capture)
      const result = existingRows.lap ?? existingRows.match
      if (
        !start ||
        result?.deletedAt ||
        result?.status === 'completed' ||
        result?.status === 'cancelled'
      )
        return false
      let matchedTrack = start.map
        ? TrackSource.findByUid(start.map.uid)
        : undefined
      if (start.map && !matchedTrack) {
        matchedTrack = TrackSource.create({
          ...trackMetadataFromWebhook(start.map),
          name: start.map.name,
          mapType: start.map.type,
          level: 'custom',
          game: capture.sourceGame,
        })
        trackCreated = true
      }
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
      const afterTimes = this.derivedTimes(this.events(capture.id))
      if (afterTimes) this.syncTimes(capture, beforeTimes, afterTimes)
      return trackCreated
    })
    if (createdTrack)
      void TrackManager.getAllTracks().then(all => broadcast('all_tracks', all))
    this.publishEntries()
    return 'Stored'
  }
}
