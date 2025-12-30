import type { Match } from '@common/models/match'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { Glicko2, type Player } from 'glicko2'

export class MatchRatingCalculator {
  private glicko2: Glicko2
  private readonly players: Map<string, Player>

  constructor(userIds: string[]) {
    this.glicko2 = new Glicko2({ rating: RATING_CONSTANTS.INITIAL_RATING })
    this.players = new Map()
    for (const userId of userIds) {
      this.players.set(
        userId,
        this.glicko2.makePlayer(RATING_CONSTANTS.INITIAL_RATING)
      )
    }
  }

  public reset() {
    this.glicko2 = new Glicko2()
    this.players.clear()
  }

  public getRating(userId: string): number {
    return (
      this.players.get(userId)?.getRating() ?? RATING_CONSTANTS.INITIAL_RATING
    )
  }

  public predict(match: {
    user1: Match['user1']
    user2: Match['user2']
  }): number | undefined {
    if (!match.user1 || !match.user2) return undefined

    const p1 = this.players.get(match.user1)
    const p2 = this.players.get(match.user2)

    if (!p1 || !p2) {
      console.warn('Player(s) has no rating', match.user1, match.user2)
      return undefined
    }

    return this.glicko2.predict(p1, p2)
  }

  public getOdds(match: {
    user1: Match['user1']
    user2: Match['user2']
  }): { p1Odds: number; p2Odds: number } | undefined {
    const p1WinProbability = this.predict(match)
    if (p1WinProbability === undefined) return undefined
    return {
      p1Odds: 1 / p1WinProbability,
      p2Odds: 1 / (1 - p1WinProbability),
    }
  }

  public processMatches(matches: Match[]) {
    const matchEvents: Parameters<typeof this.glicko2.addMatch>[] = []

    for (const match of matches) {
      if (match.status !== 'completed') continue
      if (!match.user1 || !match.user2 || !match.winner) {
        console.warn(`Match is not completed, skipping (${match.id})`)
        continue
      }

      const p1 = this.players.get(match.user1)
      const p2 = this.players.get(match.user2)

      if (!p1 || !p2) {
        console.warn(
          'Player(s) has no rating, skipping',
          JSON.stringify({
            id: match.id,
            user1: match.user1,
            user2: match.user2,
          })
        )
        continue
      }
      matchEvents.push([p1, p2, match.winner === match.user1 ? 1 : 0])
    }
    this.glicko2.updateRatings(matchEvents)
  }
}
