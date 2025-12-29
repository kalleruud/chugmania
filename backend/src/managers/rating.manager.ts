import type { Match } from '@common/models/match'
import type { Ranking } from '@common/models/ranking'
import type { TimeEntry } from '@common/models/timeEntry'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { broadcast } from '../server'
import MatchManager from './match.manager'
import TimeEntryManager from './timeEntry.manager'

type TrackStats = {
  count: number
  average: number
}

export class RatingCalculator {
  private matchElo: Map<string, number> = new Map()
  // Map<UserId, Map<TrackId, Rating>>
  private userTrackRatings: Map<string, Map<string, number>> = new Map()
  // Map<TrackId, TrackStats>
  private trackStats: Map<string, TrackStats> = new Map()
  // Map<TrackId, lapsCount> for weight calculation
  private trackLapsCount: Map<string, number> = new Map()

  constructor() {
    this.reset()
  }

  public reset() {
    this.matchElo.clear()
    this.userTrackRatings.clear()
    this.trackStats.clear()
    this.trackLapsCount.clear()
  }

  public getRankings(): Ranking[] {
    const uniqueUsers = new Set([
      ...this.matchElo.keys(),
      ...this.userTrackRatings.keys(),
    ])

    const rankings: Ranking[] = []

    for (const userId of uniqueUsers) {
      rankings.push({
        user: userId,
        totalRating: this.calculateTotalRating(userId),
        matchRating:
          this.matchElo.get(userId) ?? RATING_CONSTANTS.INITIAL_RATING,
        trackRating: this.calculateLapRating(userId),
        ranking: 0, // Will be set after sorting
      })
    }

    rankings.sort((a, b) => b.totalRating - a.totalRating)

    return rankings.map((r, index) => ({
      ...r,
      ranking: index + 1,
    }))
  }

  public processTimeEntry(entry: TimeEntry) {
    if (!entry.duration) return

    const trackId = entry.track
    const userId = entry.user
    const lapTime = entry.duration

    // 1. Update Track Stats
    const currentStats = this.trackStats.get(trackId) ?? {
      count: 0,
      average: 0,
    }
    const trackCount = currentStats.count
    const alpha = Math.min(
      RATING_CONSTANTS.TRACK_STATS_EMA_ALPHA_MAX,
      2 / (trackCount + 1)
    )

    // Initial average is the first lap time
    const newAverage =
      trackCount === 0
        ? lapTime
        : currentStats.average * (1 - alpha) + lapTime * alpha

    this.trackStats.set(trackId, {
      count: trackCount + 1,
      average: newAverage,
    })

    // Also track total laps for this track for weighting
    const currentLaps = this.trackLapsCount.get(trackId) ?? 0
    this.trackLapsCount.set(trackId, currentLaps + 1)

    // 2. Calculate Performance
    // PerformanceScore = 1200 + 400 * Math.log10(TrackAverage / LapTime)
    // Faster lap time -> TrackAverage / LapTime > 1 -> Positive log -> Score > 1200
    const ratio = newAverage / lapTime
    const performanceScore =
      RATING_CONSTANTS.INITIAL_RATING +
      RATING_CONSTANTS.LAP_RATING_SCALE * Math.log10(ratio)

    // 3. Update User's Track Rating (EMA)
    const userRatings = this.userTrackRatings.get(userId) ?? new Map()
    const currentTrackRating =
      userRatings.get(trackId) ?? RATING_CONSTANTS.INITIAL_RATING

    const k = RATING_CONSTANTS.USER_TRACK_EMA_ALPHA

    // Only update if new rating is better or equal, OR if it's the first few laps (to establish baseline)
    // Actually user requirement: "only increase player rating, not subtract" for track ratings?
    // "We may need to adjust the rating to only increase player rating, not subtract."
    // Let's implement a ratchet mechanism:
    // If performanceScore > currentTrackRating, use EMA to pull up.
    // If performanceScore < currentTrackRating, ignore or use very small k?
    // Strict ratchet: newTrackRating = Math.max(currentTrackRating, currentTrackRating * (1 - k) + performanceScore * k)
    // But this prevents regression if a player gets worse or if early luck was high.
    // However, for "Best Lap" style ratings, we often only care about peak performance.
    // Let's try: Performance Score acts as a target.
    // If Performance Score > Current Rating, standard update.
    // If Performance Score < Current Rating, do nothing (or very slow decay).
    // The prompt says "only increase". Let's stick to that strictly for now to widen spread at top.

    let newTrackRating = currentTrackRating
    if (performanceScore > currentTrackRating) {
      newTrackRating = currentTrackRating * (1 - k) + performanceScore * k
    } else {
      // Optional: Very slow decay or no change.
      // If we strictly don't subtract, rating only goes up.
      // This might inflate ratings indefinitely if averages drop.
      // But "Track Average" updates independently.
      // Let's stick to "no subtraction" from the *User's Track Rating*.
      newTrackRating = currentTrackRating
    }

    userRatings.set(trackId, newTrackRating)
    this.userTrackRatings.set(userId, userRatings)
  }

  public processMatch(match: Match) {
    if (
      match.status !== 'completed' ||
      !match.winner ||
      !match.user1 ||
      !match.user2
    )
      return

    // Ensure both users have an ELO entry
    if (!this.matchElo.has(match.user1)) {
      this.matchElo.set(match.user1, RATING_CONSTANTS.INITIAL_RATING)
    }
    if (!this.matchElo.has(match.user2)) {
      this.matchElo.set(match.user2, RATING_CONSTANTS.INITIAL_RATING)
    }

    const user1Total = this.calculateTotalRating(match.user1)
    const user2Total = this.calculateTotalRating(match.user2)

    const winnerId = match.winner
    const user1Score = winnerId === match.user1 ? 1 : 0
    const user2Score = winnerId === match.user2 ? 1 : 0

    const expected1 = 1 / (1 + Math.pow(10, (user2Total - user1Total) / 400))
    const expected2 = 1 / (1 + Math.pow(10, (user1Total - user2Total) / 400))

    const k = RATING_CONSTANTS.MATCH_K_FACTOR

    const delta1 = k * (user1Score - expected1)
    const delta2 = k * (user2Score - expected2)

    this.matchElo.set(match.user1, this.matchElo.get(match.user1)! + delta1)
    this.matchElo.set(match.user2, this.matchElo.get(match.user2)! + delta2)
  }

  private calculateTotalRating(userId: string): number {
    const matchElo =
      this.matchElo.get(userId) ?? RATING_CONSTANTS.INITIAL_RATING
    const lapRating = this.calculateLapRating(userId)

    return (
      RATING_CONSTANTS.MATCH_WEIGHT * matchElo +
      (1 - RATING_CONSTANTS.MATCH_WEIGHT) * lapRating
    )
  }

  private calculateLapRating(userId: string): number {
    const userRatings = this.userTrackRatings.get(userId)

    // If no laps, return initial rating
    if (!userRatings || userRatings.size === 0) {
      return RATING_CONSTANTS.INITIAL_RATING
    }

    let sumWeightedRatings = 0
    let sumWeights = 0

    // Iterate all tracks we have stats for, not just what the user has driven
    // Although the plan says "UserTrackRating_t * Weight_t", implying only tracks the user has driven.
    // However, the prior handles the "undriven" tracks conceptually.
    // Let's stick to the plan: Sum over UserTrackRating entries.

    for (const [trackId, rating] of userRatings.entries()) {
      const trackLaps = this.trackLapsCount.get(trackId) ?? 0

      // Weight_t = 1 - Math.exp(-TrackTotalLaps / 50)
      const weight =
        1 - Math.exp(-trackLaps / RATING_CONSTANTS.TRACK_MATURITY_LAPS)

      sumWeightedRatings += rating * weight
      sumWeights += weight
    }

    // Add Bayesian Prior
    // PriorWeight = 5.0
    // SumWeightedRatings += 1200 * PriorWeight
    // SumWeights += PriorWeight

    sumWeightedRatings +=
      RATING_CONSTANTS.INITIAL_RATING * RATING_CONSTANTS.PRIOR_WEIGHT
    sumWeights += RATING_CONSTANTS.PRIOR_WEIGHT

    return sumWeightedRatings / sumWeights
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

    // We might want to seed this calculator with GLOBAL track stats if we want "fair" comparison
    // against global averages, OR we might want purely local session stats.
    // Given the requirement "calculate ratings inside of a specific session",
    // implying isolation, let's start fresh.
    // If we wanted to contextually rate them against global standards, we'd need to copy global stats.
    // Let's assume isolation for now as per "subset of laptimes... into rating manager".

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
