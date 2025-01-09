import GroupManager from './group.manager'
import MatchManager from './match.manager'
import type { PublicUser } from './user.manager'

export default class TournamentManager {
  static async generateGroups(sessionId: string, users: PublicUser[], groupCount: 2 | 4 | 8 | 16) {
    console.debug('Generating groups for session', sessionId)
    const shuffledusers = [...users].sort(() => Math.random() - 0.5)
    const groups = await GroupManager.create(sessionId, groupCount)

    const baseSize = Math.floor(shuffledusers.length / groupCount)
    const extrausers = shuffledusers.length % groupCount

    // Determine group distribution order (middle to outward)
    const middleIndex = Math.floor(groupCount / 2)
    const distributionOrder = Array.from({ length: groupCount }, (_, i) =>
      i % 2 === 0 // If even, move right, else move left
        ? middleIndex + Math.floor(i / 2)
        : middleIndex - Math.ceil(i / 2)
    )

    // Determine group sizes
    const sizes = distributionOrder.map((_, i) => baseSize + (i < extrausers ? 1 : 0))

    await Promise.all(
      distributionOrder.map(async (groupIndex, i) => {
        const group = groups[groupIndex]
        const index = sizes.slice(0, i).reduce((acc, size) => acc + size, 0)
        const size = sizes[i]

        await GroupManager.addUsers(
          group.id,
          shuffledusers.slice(index, index + size).map(user => user.id)
        )
      })
    )
    return groups
  }

  static async clearGroups(sessionId: string) {
    console.debug('Clearing groups for session', sessionId)
    const groups = await GroupManager.getAllFromSession(sessionId)
    await Promise.all(groups.map(group => GroupManager.delete(group.id)))
  }

  static genratePairings<T>(players: T[]) {
    const rounds = players.length % 2 === 0 ? players.length - 1 : players.length
    const half = Math.ceil(players.length / 2)

    const pairings = new Array<{ a: T; b: T }>()
    const playerIndexes = players.map((_, i) => i)

    for (let i = 0; i < rounds; i++) {
      const firstHalf = playerIndexes.slice(0, half)
      const secondHalf = playerIndexes.slice(half, players.length).reverse()
      console.log(firstHalf, secondHalf)

      for (let j = 0; j < firstHalf.length; j++) {
        if (j >= secondHalf.length) continue
        pairings.push({
          a: players[firstHalf[j]],
          b: players[secondHalf[j]],
        })
      }

      playerIndexes.push(playerIndexes.shift()!)
    }

    return pairings
  }

  static async clearMatches(sessionId: string) {
    console.debug('Clearing matches for session', sessionId)
    await MatchManager.deleteAllFromSession(sessionId)
  }
}
