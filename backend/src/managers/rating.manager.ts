import type { Match } from '@common/models/match'
import type { Ranking } from '@common/models/ranking'
import type { Session } from '@common/models/session'
import type { TimeEntry } from '@common/models/timeEntry'
import type { User } from '@common/models/user'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { formatDateWithYear } from '@common/utils/date'
import { and, asc, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import db from '../../database/database'
import { matches, sessions, timeEntries } from '../../database/schema'
import {
  MatchRatingCalculator,
  TrackRatingCalculator,
} from './rating.calculator'

class RatingManagerClass {
  private readonly matchCalculator: MatchRatingCalculator =
    new MatchRatingCalculator()
  private readonly trackCalculator: TrackRatingCalculator =
    new TrackRatingCalculator()

  private ratings: Map<User['id'], Ranking> = new Map()

  private reset() {
    RatingManager.matchCalculator.reset()
    RatingManager.trackCalculator.reset()
    RatingManager.ratings = new Map()
  }

  async recalculate() {
    RatingManager.reset()

    const sessionRows = await db
      .select()
      .from(sessions)
      .where(isNull(sessions.deletedAt))
      .orderBy(desc(sessions.date), asc(sessions.createdAt))
    const sessionInputs = await Promise.all(
      sessionRows.toReversed().map(async session => ({
        session,
        input: await RatingManager.getSessionRatingInput(session.id),
      }))
    )

    for (const { session, input } of sessionInputs) {
      console.log(
        `Processing session ${session.name} (${formatDateWithYear(session.date)})`
      )
      RatingManager.matchCalculator.processMatches(input.matches)
      RatingManager.trackCalculator.processTimeEntries(input.timeEntries)
    }

    RatingManager.ratings = RatingManager.calculateRatings()
  }

  private async getSessionRatingInput(
    sessionId: Session['id']
  ): Promise<{ matches: Match[]; timeEntries: TimeEntry[] }> {
    const [matches, timeEntries] = await Promise.all([
      RatingManager.getMatchesBySession(sessionId),
      RatingManager.getLatestTimeEntriesAfterSession(sessionId),
    ])

    return { matches, timeEntries }
  }

  private async getMatchesBySession(
    sessionId: Session['id']
  ): Promise<Match[]> {
    return await db
      .select({ ...getTableColumns(matches) })
      .from(matches)
      .where(and(eq(matches.session, sessionId), isNull(matches.deletedAt)))
      .orderBy(desc(matches.createdAt))
  }

  private async getLatestTimeEntriesAfterSession(
    sessionId: Session['id']
  ): Promise<TimeEntry[]> {
    const latestDatePerUser = db
      .select({
        user: timeEntries.user,
        maxDate: sql<Date>`max(${timeEntries.createdAt})`.as('maxDate'),
      })
      .from(timeEntries)
      .where(eq(timeEntries.session, sessionId))
      .groupBy(timeEntries.user)
      .as('latest_date')

    const latestBestPerUser = db
      .select({
        user: timeEntries.user,
        createdAt: timeEntries.createdAt,
        minDuration: sql<number>`min(${timeEntries.duration})`.as(
          'minDuration'
        ),
      })
      .from(timeEntries)
      .innerJoin(
        latestDatePerUser,
        and(
          eq(timeEntries.user, latestDatePerUser.user),
          eq(timeEntries.createdAt, latestDatePerUser.maxDate)
        )
      )
      .groupBy(timeEntries.user, timeEntries.createdAt)
      .as('latest_best')

    return await db
      .select({ ...getTableColumns(timeEntries) })
      .from(timeEntries)
      .innerJoin(
        latestBestPerUser,
        and(
          eq(timeEntries.user, latestBestPerUser.user),
          eq(timeEntries.createdAt, latestBestPerUser.createdAt),
          eq(timeEntries.duration, latestBestPerUser.minDuration)
        )
      )
      .where(eq(timeEntries.session, sessionId))
  }

  getUserRatings(userId: string): Ranking | undefined {
    if (RatingManager.ratings.size === 0) {
      throw new Error('Ratings not calculated')
    }
    return RatingManager.ratings.get(userId)
  }

  // Returns all users with their ratings, sorted by ranking.
  onGetRatings(): Ranking[] {
    if (RatingManager.ratings.size === 0)
      RatingManager.ratings = RatingManager.calculateRatings()

    return Array.from(RatingManager.ratings.values()).sort(
      (a, b) => b.ranking - a.ranking
    )
  }

  private calculateRatings() {
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
const RatingManager = new RatingManagerClass()

export default RatingManager
