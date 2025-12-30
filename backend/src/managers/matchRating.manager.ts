import type { Match } from '@common/models/match'
import { RATING_CONSTANTS } from '@common/utils/constants'

export class MatchRatingCalculator {
  private readonly elo: Map<string, number> = new Map()

  constructor() {
    this.reset()
  }

  public reset() {
    this.elo.clear()
  }

  public getRating(userId: string): number {
    return this.elo.get(userId) ?? RATING_CONSTANTS.INITIAL_RATING
  }

  public processMatch(
    match: Match,
    getTrackRating: (userId: string) => number
  ) {
    if (
      match.status !== 'completed' ||
      !match.winner ||
      !match.user1 ||
      !match.user2
    )
      return

    // Ensure both users have an ELO entry
    if (!this.elo.has(match.user1)) {
      this.elo.set(match.user1, RATING_CONSTANTS.INITIAL_RATING)
    }
    if (!this.elo.has(match.user2)) {
      this.elo.set(match.user2, RATING_CONSTANTS.INITIAL_RATING)
    }

    // Use total rating for expected score calculation to prevent farming
    // We need to inject the aggregation logic or call back to a shared calculator.
    // However, the prompt says "separate managers".
    // To keep ELO math correct according to the plan ("TotalRating ... used to calculate win probabilities"),
    // this manager needs access to TotalRating.
    // TotalRating = Weight * MatchRating + Weight * TrackRating.
    // So we need TrackRating here.

    const user1MatchRating = this.getRating(match.user1)
    const user2MatchRating = this.getRating(match.user2)

    const user1TrackRating = getTrackRating(match.user1)
    const user2TrackRating = getTrackRating(match.user2)

    // Calculate Total Rating dynamically
    // Total = M_W * Match + L_W * Lap
    // Note: LAP_WEIGHT is implicit 1 - MATCH_WEIGHT usually, but we have explicit constants.
    // Let's use constants directly.

    // We need to normalize track rating before mixing if required?
    // "NormalizedLap = 1200 + (LapRating - 1200) * 0.6" - this logic was in RatingManager.
    // We should move this logic to a shared utility or duplicate it here?
    // The requirement "individually tuned" suggests separation.

    // Let's implement calculateTotalRating helper here or pass it in.
    // Passing `getTrackRating` callback is cleaner.

    const user1Total =
      RATING_CONSTANTS.MATCH_WEIGHT * user1MatchRating +
      (1 - RATING_CONSTANTS.MATCH_WEIGHT) * user1TrackRating

    const user2Total =
      RATING_CONSTANTS.MATCH_WEIGHT * user2MatchRating +
      (1 - RATING_CONSTANTS.MATCH_WEIGHT) * user2TrackRating

    const winnerId = match.winner
    const user1Score = winnerId === match.user1 ? 1 : 0
    const user2Score = winnerId === match.user2 ? 1 : 0

    const expected1 = 1 / (1 + Math.pow(10, (user2Total - user1Total) / 400))
    const expected2 = 1 / (1 + Math.pow(10, (user1Total - user2Total) / 400))

    const k = RATING_CONSTANTS.MATCH_K_FACTOR

    const delta1 = k * (user1Score - expected1)
    const delta2 = k * (user2Score - expected2)

    this.elo.set(match.user1, user1MatchRating + delta1)
    this.elo.set(match.user2, user2MatchRating + delta2)
  }
}

export default new MatchRatingCalculator()
