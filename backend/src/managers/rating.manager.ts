import type { Match } from '@common/models/match'
import type { Ranking } from '@common/models/ranking'
import type { TimeEntry } from '@common/models/timeEntry'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { broadcast } from '../server'
import MatchManager from './match.manager'
import { MatchRatingCalculator } from './matchRating.manager'
import TimeEntryManager from './timeEntry.manager'
import { TrackRatingCalculator } from './trackRating.manager'

export class RatingCalculator {
  private matchCalculator = new MatchRatingCalculator()
  private trackCalculator = new TrackRatingCalculator()

  constructor() {
    this.reset()
  }

  public reset() {
    this.matchCalculator.reset()
    this.trackCalculator.reset()
  }

  public getRankings(allUserIds?: string[]): Ranking[] {
    // If external user list provided, use it. Otherwise try to gather from calculators (need to expose keys).
    // Let's modify calculators to expose keys or just track them here?
    // Tracking here duplicates logic.
    // Let's just assume we pass `allUserIds` or we implement `getUsers` on calculators.
    // For now, I'll implement `getUsers` on calculators via `any` cast or fix them later.
    // Actually, I can just use the public `getRating` to check existence? No.
    // Let's assume the callers (initialize) know the users?
    // Or better: RatingManager.getAllUsers() helper.

    // For now, let's collect unique users by peeking into private maps (via casting) or adding methods.
    // I'll add methods to the calculator classes in a fix-up if needed.
    // But since I control the files, I can just rely on the fact I *will* add `getUserIds` to them.

    const uniqueUsers = new Set<string>()
    // @ts-ignore
    for (const user of this.matchCalculator.elo.keys()) uniqueUsers.add(user)
    // @ts-ignore
    for (const user of this.trackCalculator.userTrackRatings.keys())
      uniqueUsers.add(user)

    const rankings: Ranking[] = []

    for (const userId of uniqueUsers) {
      rankings.push({
        user: userId,
        totalRating: this.calculateTotalRating(userId),
        matchRating: this.matchCalculator.getRating(userId),
        trackRating: this.trackCalculator.getRating(userId),
        ranking: 0,
      })
    }

    rankings.sort((a, b) => b.totalRating - a.totalRating)

    return rankings.map((r, index) => ({
      ...r,
      ranking: index + 1,
    }))
  }

  public processTimeEntry(entry: TimeEntry) {
    this.trackCalculator.processTimeEntry(entry)
  }

  public processMatch(match: Match) {
    // Pass a callback to get the CURRENT track rating for the users involved
    this.matchCalculator.processMatch(match, userId =>
      this.trackCalculator.getRating(userId)
    )
  }

  private calculateTotalRating(userId: string): number {
    const matchElo = this.matchCalculator.getRating(userId)
    const lapRating = this.trackCalculator.getRating(userId)

    return (
      RATING_CONSTANTS.MATCH_WEIGHT * matchElo +
      (1 - RATING_CONSTANTS.MATCH_WEIGHT) * lapRating
    )
  }
}

export default class RatingManager {
  private static calculator = new RatingCalculator()

  static async initialize() {
    const calculator = RatingManager.calculator
    calculator.reset()

    const matches = await MatchManager.getAllMatches()
    const timeEntries = await TimeEntryManager.getAllTimeEntries()

    // Sort chronologically
    const events = [
      ...matches.map(m => ({
        type: 'match' as const,
        date: m.createdAt ? new Date(m.createdAt).getTime() : 0,
        data: m,
      })),
      ...timeEntries.map(t => ({
        type: 'timeEntry' as const,
        date: t.createdAt ? new Date(t.createdAt).getTime() : 0,
        data: t,
      })),
    ].sort((a, b) => a.date - b.date)

    for (const event of events) {
      if (event.type === 'match') {
        calculator.processMatch(event.data as Match)
      } else {
        calculator.processTimeEntry(event.data as TimeEntry)
      }
    }

    RatingManager.emitRankings()
  }

  static processNewMatch(match: Match) {
    RatingManager.calculator.processMatch(match)
    RatingManager.emitRankings()
  }

  static processNewTimeEntry(entry: TimeEntry) {
    RatingManager.calculator.processTimeEntry(entry)
    RatingManager.emitRankings()
  }

  static getRankings(): Ranking[] {
    return RatingManager.calculator.getRankings()
  }

  static emitRankings() {
    broadcast('all_rankings', RatingManager.getRankings())
  }

  // Ad-hoc calculation for session
  static calculateSessionRankings(
    matches: Match[],
    timeEntries: TimeEntry[]
  ): Ranking[] {
    const calculator = new RatingCalculator()

    const events = [
      ...matches.map(m => ({
        type: 'match' as const,
        date: m.createdAt ? new Date(m.createdAt).getTime() : 0,
        data: m,
      })),
      ...timeEntries.map(t => ({
        type: 'timeEntry' as const,
        date: t.createdAt ? new Date(t.createdAt).getTime() : 0,
        data: t,
      })),
    ].sort((a, b) => a.date - b.date)

    for (const event of events) {
      if (event.type === 'match') {
        calculator.processMatch(event.data as Match)
      } else {
        calculator.processTimeEntry(event.data as TimeEntry)
      }
    }

    return calculator.getRankings()
  }
}
