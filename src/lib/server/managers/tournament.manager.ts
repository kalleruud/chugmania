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

  static generateMatchesForGroup(players: PublicUser[]) {
    const matches = new Array<{ user1: string; user2: string }>()

    for (let i = 0; i < players.length - 1; i++) {
      const user1 = players[i].name
      for (let j = i + 1; j < players.length; j++) {
        const user2 = players[j].name
        matches.push({ user1, user2 })
      }
    }

    const lastPlayed = new Map<string, number>()
    const interleavedMatches: { user1: string; user2: string }[] = []

    for (let i = 0; i < matches.length; i++) {
      interleavedMatches[i] = matches[i]
      for (let j = i + 1; j < matches.length; j++) {
        const matchA = interleavedMatches[i]
        const matchB = matches[j]
        const lastPlayedA =
          (lastPlayed.get(matchA.user1) ?? -1) + (lastPlayed.get(matchA.user2) ?? -1)
        const lastPlayedB =
          (lastPlayed.get(matchB.user1) ?? -1) + (lastPlayed.get(matchB.user2) ?? -1)
        if (lastPlayedA === -2) break
        if (lastPlayedA > lastPlayedB) {
          interleavedMatches[i] = matchB
          matches[j] = matchA
          console.log('Setting', matchB.user1, 'vs', matchB.user2, 'at', i)
        }
      }
      lastPlayed.set(interleavedMatches[i].user1, i)
      lastPlayed.set(interleavedMatches[i].user2, i)
    }
  }

  static async clearMatches(sessionId: string) {
    console.debug('Clearing matches for session', sessionId)
    await MatchManager.deleteAllFromSession(sessionId)
  }
}
