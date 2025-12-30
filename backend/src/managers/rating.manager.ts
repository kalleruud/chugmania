import type { Match } from '@common/models/match'
import type { Ranking } from '@common/models/ranking'
import type { Session } from '@common/models/session'
import type { TimeEntry } from '@common/models/timeEntry'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { formatDateWithYear } from '@common/utils/date'
import MatchManager from './match.manager'
import {
  MatchRatingCalculator,
  TrackRatingCalculator,
} from './rating.calculator'
import SessionManager from './session.manager'
import TimeEntryManager from './timeEntry.manager'
import UserManager from './user.manager'

export default class RatingManager {
  private static readonly matchCalculator: MatchRatingCalculator =
    new MatchRatingCalculator()
  private static readonly trackCalculator: TrackRatingCalculator =
    new TrackRatingCalculator()

  private static reset() {
    RatingManager.matchCalculator.reset()
    RatingManager.trackCalculator.reset()
  }

  static async recalculate() {
    RatingManager.reset()

    const sessions = await SessionManager.getAllSessions()
    for (const session of sessions.toReversed()) {
      console.log(
        `Processing session ${session.name} (${formatDateWithYear(session.date)})`
      )
      await RatingManager.processSession(session.id)
    }
  }

  private static async processSession(sessionId: Session['id']) {
    const matches = await MatchManager.getAllBySession(sessionId)
    RatingManager.matchCalculator.processMatches(matches)

    const timeEntries = await TimeEntryManager.getAllBySession(sessionId)
    RatingManager.trackCalculator.processTimeEntries(timeEntries)
  }

  static processMatches(matches: Match[]) {
    RatingManager.matchCalculator.processMatches(matches)
  }

  static processTimeEntries(timeEntries: TimeEntry[]) {
    RatingManager.trackCalculator.processTimeEntries(timeEntries)
  }

  // Returns all users with their ratings, sorted by ranking.
  static async onGetRatings(): Promise<Ranking[]> {
    const users = await UserManager.getAllUsers()
    const matchRatings = RatingManager.matchCalculator.getAllRatings()
    const trackRatings = RatingManager.trackCalculator.getAllRatings()

    const rankings: Ranking[] = []
    for (const user of users) {
      const matchRating = matchRatings.get(user.id) ?? 0
      const trackRating = trackRatings.get(user.id) ?? 0

      const totalRating =
        matchRating * RATING_CONSTANTS.MATCH_WEIGHT +
        trackRating * (1 - RATING_CONSTANTS.MATCH_WEIGHT)

      rankings.push({
        user: user.id,
        totalRating,
        matchRating,
        trackRating,
        ranking: 0, // Will be updated later
      })
    }

    rankings.sort((a, b) => b.totalRating - a.totalRating)
    for (let i = 0; i < rankings.length; i++) {
      rankings[i].ranking = i + 1
    }

    return rankings
  }
}
