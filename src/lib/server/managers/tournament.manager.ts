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

    await Promise.all(
      distributionOrder.map(async (groupIndex, i) => {
        const group = groups[groupIndex]

        const groupSize = baseSize + (i < extraPlayers ? 1 : 0)
        const players = shuffledPlayers.slice(i * groupSize, (i + 1) * groupSize)

        await GroupManager.addUsers(
          group.id,
          players.map(player => player.id)
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
