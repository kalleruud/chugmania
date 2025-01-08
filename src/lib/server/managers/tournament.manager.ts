import GroupManager from './group.manager'
import type { PublicUser } from './user.manager'

export default class TournamentManager {
  static async generateGroups(
    sessionId: string,
    players: PublicUser[],
    groupCount: 2 | 4 | 8 | 16
  ) {
    console.debug('Generating groups for session', sessionId)
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5)
    const groups = await GroupManager.create(sessionId, groupCount)

    const baseSize = Math.floor(shuffledPlayers.length / groupCount)
    const extraPlayers = shuffledPlayers.length % groupCount

    // Determine group distribution order (middle to outward)
    const middleIndex = Math.floor(groupCount / 2)
    const distributionOrder = Array.from({ length: groupCount }, (_, i) =>
      i % 2 === 0 // If even, move right, else move left
        ? middleIndex + Math.floor(i / 2)
        : middleIndex - Math.ceil(i / 2)
    )

    // Determine group sizes
    const sizes = distributionOrder.map((_, i) => baseSize + (i < extraPlayers ? 1 : 0))

    await Promise.all(
      distributionOrder.map(async (groupIndex, i) => {
        const group = groups[groupIndex]
        const index = sizes.slice(0, i).reduce((acc, size) => acc + size, 0)
        const size = sizes[i]

        await GroupManager.addUsers(
          group.id,
          shuffledPlayers.slice(index, index + size).map(player => player.id)
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
}
