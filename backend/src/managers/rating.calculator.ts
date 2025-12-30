import type { Match } from '@common/models/match'
import type { TimeEntry } from '@common/models/timeEntry'
import type { Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { Glicko2, type Player } from 'glicko2'

abstract class RatingCalculator {
  protected glicko2: Glicko2
  protected readonly players: Map<UserInfo['id'], Player>

  constructor() {
    this.glicko2 = new Glicko2({ rating: RATING_CONSTANTS.INITIAL_RATING })
    this.players = new Map()
  }

  public reset() {
    this.glicko2 = new Glicko2()
    this.players.clear()
  }

  // Returns all ratings in the calculator, sorted by rating.
  public getAllRatings(): Map<UserInfo['id'], number> {
    return new Map(
      Array.from(this.players.keys()).map(userId => [
        userId,
        this.getRating(userId),
      ])
    )
  }

  protected getPlayer(userId: UserInfo['id']): Player {
    let player = this.players.get(userId)
    if (player) return player

    player = this.glicko2.makePlayer(RATING_CONSTANTS.INITIAL_RATING)
    this.players.set(userId, player)
    return player
  }

  public getRating(userId: UserInfo['id']): number {
    const player = this.players.get(userId)
    if (!player) return 0
    return (
      player.getRating() - RATING_CONSTANTS.DEVIATION_PENALTY * player.getRd()
    )
  }

  public predict(
    user1: UserInfo['id'],
    user2: UserInfo['id']
  ): number | undefined {
    if (!user1 || !user2) return undefined

    const p1 = this.players.get(user1)
    const p2 = this.players.get(user2)

    if (!p1 || !p2) {
      console.warn('Player(s) has no rating', user1, user2)
      return undefined
    }

    return this.glicko2.predict(p1, p2)
  }

  public getOdds(
    user1: UserInfo['id'],
    user2: UserInfo['id']
  ): { p1Odds: number; p2Odds: number } | undefined {
    const p1WinProbability = this.predict(user1, user2)
    if (p1WinProbability === undefined) return undefined
    return {
      p1Odds: 1 / p1WinProbability,
      p2Odds: 1 / (1 - p1WinProbability),
    }
  }
}

export class MatchRatingCalculator extends RatingCalculator {
  public processMatches(matches: Match[]) {
    const matchEvents: Parameters<typeof this.glicko2.addMatch>[] = []

    for (const match of matches) {
      if (match.status !== 'completed') continue
      if (!match.user1 || !match.user2 || !match.winner) {
        console.warn(`Match is not completed, skipping (${match.id})`)
        continue
      }

      matchEvents.push([
        this.getPlayer(match.user1),
        this.getPlayer(match.user2),
        match.winner === match.user1 ? 1 : 0,
      ])
    }
    if (matchEvents.length === 0) return
    this.glicko2.updateRatings(matchEvents)
    console.log('  - Match ratings:', this.getAllRatings())
  }
}

export class TrackRatingCalculator extends RatingCalculator {
  public processTimeEntries(timeEntries: TimeEntry[]) {
    const entriesByTrack = timeEntries.reduce(
      (acc, entry) => {
        acc[entry.track] = [...(acc[entry.track] || []), entry]
        return acc
      },
      {} as Record<Track['id'], TimeEntry[]>
    )

    for (const entries of Object.values(entriesByTrack)) {
      const leaderboard = this.getLeaderboard(entries)
      const race = this.glicko2.makeRace(leaderboard)
      this.glicko2.updateRatings(race)
    }

    console.log('  - Track ratings:', this.getAllRatings())
  }

  // Returns a list of players sorted by lap time.
  // Players with the same lap time are grouped together.
  private getLeaderboard(entries: TimeEntry[]): Player[][] {
    const sortedEntries = entries.toSorted(
      (a, b) =>
        (a.duration ?? Number.MAX_SAFE_INTEGER) -
        (b.duration ?? Number.MAX_SAFE_INTEGER)
    )

    const leaderboard: Player[][] = []
    let lastDuration: number | undefined = undefined

    for (const entry of sortedEntries) {
      const player = this.getPlayer(entry.user)
      const duration = entry.duration ?? Number.MAX_SAFE_INTEGER

      if (lastDuration === duration) {
        leaderboard.at(-1)?.push(player)
      } else {
        lastDuration = duration
        leaderboard.push([player])
      }
    }

    return leaderboard
  }
}
