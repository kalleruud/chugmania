import type { Session } from '@common/models/session'
import type { Result } from '@common/utils/try-catch'
import { DateTime } from 'luxon'
import { isDeepStrictEqual } from 'node:util'
import MatchSource from '../../database/sources/match.source'
import SessionSource from '../../database/sources/session.source'
import TimeEntrySource from '../../database/sources/timeEntry.source'
import TrackSource from '../../database/sources/track.source'
import TransactionSource from '../../database/sources/transaction.source'
import WebhookSource, {
  type WebhookCapture,
} from '../../database/sources/webhook.source'
import { isWebhookEvent } from '../models/webhook'
import type {
  Event,
  Map,
  Player,
  StartEvent,
} from '../models/webhook.generated'
import { broadcast } from '../server'
import MatchManager from './match.manager'
import TimeEntryManager from './timeEntry.manager'
import TrackManager from './track.manager'

type PlayerTimes = {
  finishDurationMs: number | null
  chugDurationMs: number | null
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
  static findSession(now = new Date(), id?: string): Session | undefined {
    const yesterday = DateTime.fromJSDate(now, { zone: 'Europe/Oslo' })
      .startOf('day')
      .minus({ days: 1 })
      .toJSDate()
    return SessionSource.findStartedWithin(now, yesterday, id)
  }

  private static loadEvents(captureId: string): Event[] {
    return WebhookSource.getEvents(captureId).map(row => {
      const value: unknown = JSON.parse(row.rawPayload)
      if (!isWebhookEvent(value))
        throw new Error('Invalid stored webhook event')
      return value
    })
  }

  private static deriveTimes(events: Event[]): PlayerTimes[] | null {
    const start = events.find(
      (event): event is StartEvent => event.type === 'start'
    )
    if (!start) return null
    const end = events.find(event => event.type === 'end')
    return start.players.map(player => {
      const playerEvents = events.filter(
        event =>
          event.type !== 'start' &&
          event.type !== 'end' &&
          event.player.playerIndex === player.playerIndex &&
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

  private static findResultRows(capture: WebhookCapture) {
    return {
      lap: TimeEntrySource.findByCapture(capture.id),
      match: MatchSource.findByCapture(capture.id),
    }
  }

  private static currentTimes(capture: WebhookCapture): PlayerTimes[] {
    const { lap, match } = this.findResultRows(capture)
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
    capture: WebhookCapture,
    before: PlayerTimes[] | null,
    after: PlayerTimes[],
    events: Event[]
  ): void {
    const status = events.some(
      event => event.type === 'finish' || event.type === 'end'
    )
      ? 'draft'
      : 'in_progress'
    const times = this.currentTimes(capture).map((current, i) => {
      const wasManuallyChanged = (key: keyof PlayerTimes) =>
        current[key] !== (before?.[i]?.[key] ?? null)
      return {
        finishDurationMs: wasManuallyChanged('finishDurationMs')
          ? current.finishDurationMs
          : after[i].finishDurationMs,
        chugDurationMs: wasManuallyChanged('chugDurationMs')
          ? current.chugDurationMs
          : after[i].chugDurationMs,
      }
    })
    const { lap, match } = this.findResultRows(capture)
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

  private static publishFeed(
    captureId: string,
    feed: string,
    publish: () => Promise<void>
  ): void {
    void publish().catch((error: unknown) => {
      console.error('Webhook publication failed', { captureId, feed }, error)
    })
  }

  private static publishEntries(
    captureId: string,
    trackCreated: boolean
  ): void {
    this.publishFeed(captureId, 'all_time_entries', async () => {
      broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())
    })
    this.publishFeed(captureId, 'all_matches', async () => {
      broadcast('all_matches', await MatchManager.getAllMatches())
    })
    if (trackCreated)
      this.publishFeed(captureId, 'all_tracks', async () => {
        broadcast('all_tracks', await TrackManager.getAllTracks())
      })
  }

  private static validateCaptureEvent(
    capture: WebhookCapture,
    event: Event
  ): void {
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
  }

  private static matchesRosterPlayer(
    player: Player,
    expected: Player
  ): boolean {
    const identityKeys: ('name' | 'login' | 'localId' | 'accountId')[] = [
      'name',
      'login',
      'localId',
      'accountId',
    ]
    return identityKeys.every(
      key => player[key] === undefined || player[key] === expected[key]
    )
  }

  private static validateRoster(events: Event[], start: StartEvent): void {
    for (const event of events) {
      if (event.type === 'start' || event.type === 'end') continue
      const expected = start.players.at(event.player.playerIndex)
      if (!expected || !this.matchesRosterPlayer(event.player, expected))
        throw new WebhookError(
          409,
          'PLAYER_CONFLICT',
          'Player does not match the start roster'
        )
    }
  }

  private static resolveTrack(capture: WebhookCapture, map: Map | null) {
    if (!map) return { track: undefined, created: false }
    const existingTrack = TrackSource.findByUid(map.uid)
    if (existingTrack) return { track: existingTrack, created: false }
    const track = TrackSource.create({
      ...trackMetadataFromWebhook(map),
      name: map.name,
      mapType: map.type,
      level: 'custom',
      game: capture.sourceGame,
    })
    return { track, created: true }
  }

  private static ensureResult(
    capture: WebhookCapture,
    start: StartEvent,
    now: Date
  ): { writable: boolean; trackCreated: boolean } {
    const { lap, match } = this.findResultRows(capture)
    const result = lap ?? match
    if (
      result?.deletedAt ||
      result?.status === 'completed' ||
      result?.status === 'cancelled'
    )
      return { writable: false, trackCreated: false }
    const { track, created } = this.resolveTrack(capture, start.map)
    const entry = {
      webhookCapture: capture.id,
      session: capture.session,
      track: track?.id,
      createdAt: now,
    }
    if (capture.totalPlayers === 1 && !lap)
      TimeEntrySource.create({ ...entry, status: 'in_progress' })
    if (capture.totalPlayers === 2 && !match)
      MatchSource.create({ ...entry, status: 'in_progress' })
    return { writable: true, trackCreated: created }
  }

  private static storeEvent(
    event: Event,
    rawPayload: string,
    now: Date,
    existingCapture: WebhookCapture | undefined,
    session: Session
  ): boolean {
    const capture =
      existingCapture ??
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
    this.validateCaptureEvent(capture, event)
    const storedEvents = this.loadEvents(capture.id)
    const nextEvents = [...storedEvents, event].sort(
      (a, b) => a.sequence - b.sequence
    )
    const start = nextEvents.find(
      (storedEvent): storedEvent is StartEvent => storedEvent.type === 'start'
    )
    if (start) this.validateRoster(nextEvents, start)
    if (
      event.type === 'end' &&
      storedEvents.some(storedEvent => storedEvent.type === 'end')
    )
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
    if (!start) return false
    const { writable, trackCreated } = this.ensureResult(capture, start, now)
    if (!writable) return false
    const beforeTimes = this.deriveTimes(storedEvents)
    const afterTimes = this.deriveTimes(nextEvents)
    if (afterTimes) this.syncTimes(capture, beforeTimes, afterTimes, nextEvents)
    return trackCreated
  }

  static receive(
    event: Event,
    rawPayload: string,
    now = new Date()
  ): Result<string> {
    try {
      const existingEvent = WebhookSource.findEvent(event.eventId)
      if (existingEvent) {
        if (
          !isDeepStrictEqual(
            JSON.parse(existingEvent.rawPayload),
            JSON.parse(rawPayload)
          )
        )
          return {
            data: null,
            error: new WebhookError(
              409,
              'EVENT_CONFLICT',
              'Event ID already has a different payload'
            ),
          }
        return { data: 'Duplicate ignored', error: null }
      }
      const existingCapture = WebhookSource.findCapture(event.game.gameId)
      const session = this.findSession(now, existingCapture?.session)
      if (!session)
        return {
          data: null,
          error: new WebhookError(
            503,
            'NO_ACTIVE_SESSION',
            'No active receiver session can register this event'
          ),
        }
      const trackCreated = TransactionSource.run(() =>
        this.storeEvent(event, rawPayload, now, existingCapture, session)
      )
      this.publishEntries(event.game.gameId, trackCreated)
      return { data: 'Stored', error: null }
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error
            ? error
            : new Error('Webhook persistence failed', { cause: error }),
      }
    }
  }
}
