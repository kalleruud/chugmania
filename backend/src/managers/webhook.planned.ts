import { getSessionQueue } from '@common/utils/activeEntry'
import MatchSource from '../../database/sources/match.source'
import TimeEntrySource from '../../database/sources/timeEntry.source'
import TransactionSource from '../../database/sources/transaction.source'
import type { WebhookCapture } from '../../database/sources/webhook.source'
import type { Event } from '../models/webhook.generated'
import { broadcast } from '../server'
import ActiveEntryManager from './activeEntry.manager'
import MatchManager from './match.manager'
import RatingManager from './rating.manager'
import SessionManager from './session.manager'
import TimeEntryManager from './timeEntry.manager'
import TournamentManager from './tournament/tournament.manager'

export type Rows = {
  lap: ReturnType<typeof TimeEntrySource.findByCapture>
  match: ReturnType<typeof MatchSource.findByCapture>
}

type Completed = { signupChanged: boolean }

const MIN_CHUG_MS = 100

export function isChug(event: Event): boolean {
  return event.type === 'first_throttle' && event.durationMs >= MIN_CHUG_MS
}

function isRun(event: Event): boolean {
  return (
    isChug(event) ||
    event.type === 'checkpoint' ||
    event.type === 'lap' ||
    event.type === 'finish'
  )
}

export default class WebhookPlanned {
  static rows(capture: WebhookCapture): Rows {
    return {
      lap: TimeEntrySource.findByCapture(capture.id),
      match: MatchSource.findByCapture(capture.id),
    }
  }

  static hasPlayers({ lap, match }: Rows): boolean {
    return lap ? !!lap.user : !!match?.user1 && !!match.user2
  }

  static latch(capture: WebhookCapture, track: string): boolean {
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

  static complete(
    capture: WebhookCapture,
    track: string,
    events: Event[]
  ): Completed | undefined {
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
    if (!events.some(isRun)) {
      if (lap)
        TimeEntrySource.update(lap.id, {
          status: 'planned',
          webhookCapture: null,
          duration: null,
          chugDurationMs: null,
        })
      else
        MatchSource.update(result.id, {
          status: 'planned',
          webhookCapture: null,
          duration: null,
          user1DurationMs: null,
          user2DurationMs: null,
          user1ChugDurationMs: null,
          user2ChugDurationMs: null,
        })
      return
    }

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
      if (lap) TimeEntrySource.update(lap.id, { status: 'draft' })
      else if (match) MatchSource.update(match.id, { status: 'draft' })
    }
  }

  static publish(completed: Completed | undefined, latched: boolean): void {
    if (completed) {
      RatingManager.recalculate()
      broadcast('all_rankings', RatingManager.onGetRatings())
      if (completed.signupChanged)
        void SessionManager.getAllSessions().then(rows =>
          broadcast('all_sessions', rows)
        )
    }
    if (latched) TournamentManager.publish()
  }
}
