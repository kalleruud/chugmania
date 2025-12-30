import type { TimeEntry } from '@common/models/timeEntry'
import type { Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import { RATING_CONSTANTS } from '@common/utils/constants'
import { Glicko2, type Player } from 'glicko2'

export class TrackRatingCalculator {
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

  public processTimeEntries(timeEntries: TimeEntry[]) {
    const entriesByTrack = timeEntries.reduce(
      (acc, entry) => {
        acc[entry.track] = [...(acc[entry.track] || []), entry]
        return acc
      },
      {} as Record<Track['id'], TimeEntry[]>
    )

    for (const [_, entries] of Object.entries(entriesByTrack)) {
      const leaderboard = this.getLeaderboard(entries)
      const race = this.glicko2.makeRace(leaderboard)
      this.glicko2.updateRatings(race)
    }
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
      const player = this.players.get(entry.user)
      if (!player) continue
      const duration = entry.duration ?? Number.MAX_SAFE_INTEGER

      if (lastDuration && lastDuration === duration) {
        leaderboard.at(-1)?.push(player)
      } else {
        lastDuration = duration
        leaderboard.push([player])
      }
    }

    return leaderboard
  }
}
