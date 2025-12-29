import type { TimeEntry } from '@common/models/timeEntry'
import { RATING_CONSTANTS } from '@common/utils/constants'

type TrackStats = {
  count: number
  average: number
}

export class TrackRatingCalculator {
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
    this.userTrackRatings.clear()
    this.trackStats.clear()
    this.trackLapsCount.clear()
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
    const ratio = newAverage / lapTime
    const performanceScore =
      RATING_CONSTANTS.INITIAL_RATING +
      RATING_CONSTANTS.LAP_RATING_SCALE * Math.log10(ratio)

    // 3. Update User's Track Rating (EMA)
    const userRatings = this.userTrackRatings.get(userId) ?? new Map()
    const currentTrackRating =
      userRatings.get(trackId) ?? RATING_CONSTANTS.INITIAL_RATING

    const k = RATING_CONSTANTS.USER_TRACK_EMA_ALPHA

    // Ratchet mechanism: only increase rating (or maintain)
    let newTrackRating = currentTrackRating
    if (performanceScore > currentTrackRating) {
      newTrackRating = currentTrackRating * (1 - k) + performanceScore * k
    } else {
      newTrackRating = currentTrackRating
    }

    userRatings.set(trackId, newTrackRating)
    this.userTrackRatings.set(userId, userRatings)
  }

  public getRating(userId: string): number {
    const userRatings = this.userTrackRatings.get(userId)

    if (!userRatings || userRatings.size === 0) {
      return RATING_CONSTANTS.INITIAL_RATING
    }

    let sumWeightedRatings = 0
    let sumWeights = 0

    for (const [trackId, rating] of userRatings.entries()) {
      const trackLaps = this.trackLapsCount.get(trackId) ?? 0

      const weight =
        1 - Math.exp(-trackLaps / RATING_CONSTANTS.TRACK_MATURITY_LAPS)

      sumWeightedRatings += rating * weight
      sumWeights += weight
    }

    // Add Bayesian Prior
    sumWeightedRatings +=
      RATING_CONSTANTS.INITIAL_RATING * RATING_CONSTANTS.PRIOR_WEIGHT
    sumWeights += RATING_CONSTANTS.PRIOR_WEIGHT

    return sumWeightedRatings / sumWeights
  }
}

export default new TrackRatingCalculator()
