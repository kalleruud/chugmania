import type { Ranking } from '@common/models/ranking'
import type { Session } from '@common/models/session'
import type { User } from '@common/models/user'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { formatDateWithYear } from '@common/utils/date'
import MatchManager from './match.manager'
import {
  MatchRatingCalculator,
  TrackRatingCalculator,
} from './rating.calculator'
import SessionManager from './session.manager'
import TimeEntryManager from './timeEntry.manager'

export default class RatingManager {
  private static readonly matchCalculator: MatchRatingCalculator =
    new MatchRatingCalculator()
  private static readonly trackCalculator: TrackRatingCalculator =
    new TrackRatingCalculator()

  private static ratings: Map<User['id'], Ranking> = new Map()

  private static reset() {
    RatingManager.matchCalculator.reset()
    RatingManager.trackCalculator.reset()
    RatingManager.ratings = new Map()
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

    RatingManager.ratings = await RatingManager.calculateRatings()
  }

  private static async processSession(sessionId: Session['id']) {
    const matches = await MatchManager.getAllBySession(sessionId)
    RatingManager.matchCalculator.processMatches(matches)

    const timeEntries =
      await TimeEntryManager.getAllLatestAfterSession(sessionId)
    RatingManager.trackCalculator.processTimeEntries(timeEntries)
  }

  static getUserRatings(userId: string): Ranking | undefined {
    if (RatingManager.ratings.size === 0) {
      throw new Error('Ratings not calculated')
    }
    return RatingManager.ratings.get(userId)
  }

  // Returns all users with their ratings, sorted by ranking.
  static async onGetRatings(): Promise<Ranking[]> {
    if (RatingManager.ratings.size === 0)
      RatingManager.ratings = await RatingManager.calculateRatings()

    return Array.from(RatingManager.ratings.values()).sort(
      (a, b) => b.ranking - a.ranking
    )
  }

  private static async calculateRatings() {
    const matchRatings = RatingManager.matchCalculator.getAllRatings()
    const trackRatings = RatingManager.trackCalculator.getAllRatings()
    const users = Array.from(
      new Set([...matchRatings.keys(), ...trackRatings.keys()])
    )

    const ratings: Map<User['id'], Omit<Ranking, 'ranking'>> = new Map()
    for (const userId of users) {
      const matchRating =
        matchRatings.get(userId) ?? RATING_CONSTANTS.NO_DATA_RATING
      const trackRating =
        trackRatings.get(userId) ?? RATING_CONSTANTS.NO_DATA_RATING

      const totalRating =
        matchRating * RATING_CONSTANTS.MATCH_WEIGHT +
        trackRating * (1 - RATING_CONSTANTS.MATCH_WEIGHT)

      ratings.set(userId, {
        user: userId,
        totalRating,
        matchRating,
        trackRating,
      })
    }

    const newRatings: typeof RatingManager.ratings = new Map()
    const rankings = Array.from(ratings.values()).sort(
      (a, b) => b.totalRating - a.totalRating
    )
    for (let i = 0; i < rankings.length; i++) {
      newRatings.set(rankings[i].user, {
        ...rankings[i],
        ranking: i + 1,
      })
    }

    return newRatings
  }
}
