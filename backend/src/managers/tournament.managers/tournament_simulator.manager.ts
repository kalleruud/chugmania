import RatingManager from '../rating.manager'

export default class TournamentSimulatorManager {
  private static simulateMatchWinner(user1Id: string, user2Id: string): string {
    // Get ratings for both players (ratings range from ~600 to 1600, or 0 if no rating)
    const rating1 = RatingManager.getUserRatings(user1Id)?.totalRating
    const rating2 = RatingManager.getUserRatings(user2Id)?.totalRating

    // If both have no rating, 50/50 chance
    if (!rating1 && !rating2) return Math.random() < 0.5 ? user1Id : user2Id

    // If only one has a rating, that player always wins
    if (!rating2) return user1Id
    if (!rating1) return user2Id

    // Both have ratings - use rating-based probability
    // With ratings 600 - 1600, we want 1600 to beat 600 with 90%+ probability
    // Using formula: P(player1 wins) = rating1^2.5 / (rating1^2.5 + rating2^2.5)
    // This gives: 1600^2.5 / (1600^2.5 + 600^2.5) ≈ 0.915 (~91.5%)
    const r1Power = Math.pow(rating1, 2.5)
    const r2Power = Math.pow(rating2, 2.5)
    const probability = r1Power / (r1Power + r2Power)

    return Math.random() < probability ? user1Id : user2Id
  }
}
