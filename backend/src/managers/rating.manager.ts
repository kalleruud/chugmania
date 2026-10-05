import type { Ranking } from '@common/models/ranking'
import type { User } from '@common/models/user'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { asc, desc, isNull } from 'drizzle-orm'
import db from '../../database/database'
import { sessions } from '../../database/schema'
import MatchManager from './match.manager'
import {
  MatchRatingCalculator,
  TrackRatingCalculator,
} from './rating.calculator'
import TimeEntryManager from './timeEntry.manager'

export default class RatingManager {
  private static ratings = new Map<User['id'], Ranking>()

  static recalculate(): void {
    const matchCalculator = new MatchRatingCalculator()
    const trackCalculator = new TrackRatingCalculator()
    matchCalculator.reset()
    trackCalculator.reset()
    const rows = db
      .select()
      .from(sessions)
      .where(isNull(sessions.deletedAt))
      .orderBy(asc(sessions.date), desc(sessions.createdAt))
      .all()
    for (const session of rows) {
      matchCalculator.processMatches(MatchManager.getAllBySession(session.id))
      trackCalculator.processTimeEntries(
        TimeEntryManager.getAllLatestAfterSession(session.id)
      )
    }
    const matchRatings = matchCalculator.getAllRatings()
    const trackRatings = trackCalculator.getAllRatings()
    const players = new Set([...matchRatings.keys(), ...trackRatings.keys()])
    const ranked = Array.from(players, user => {
      const matchRating =
        matchRatings.get(user) ?? RATING_CONSTANTS.NO_DATA_RATING
      const trackRating =
        trackRatings.get(user) ?? RATING_CONSTANTS.NO_DATA_RATING
      return {
        user,
        matchRating,
        trackRating,
        totalRating:
          matchRating * RATING_CONSTANTS.MATCH_WEIGHT +
          trackRating * (1 - RATING_CONSTANTS.MATCH_WEIGHT),
      }
    }).sort((a, b) => b.totalRating - a.totalRating)
    RatingManager.ratings = new Map(
      ranked.map((row, index) => [row.user, { ...row, ranking: index + 1 }])
    )
  }

  static getUserRatings(userId: string): Ranking | undefined {
    return RatingManager.ratings.get(userId)
  }

  static onGetRatings(): Ranking[] {
    return Array.from(RatingManager.ratings.values()).sort(
      (a, b) => b.ranking - a.ranking
    )
  }
}
