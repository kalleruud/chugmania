import GroupManager, { type Group } from './group.manager'
import MatchManager, { type Match, type NewMatch } from './match.manager'
import type { Track } from './track.manager'
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
    await GroupManager.deleteBySession(sessionId)
    await MatchManager.deleteAllFromSession(sessionId)
  }

  private static genratePairings<T>(players: T[]) {
    const rounds = players.length % 2 === 0 ? players.length - 1 : players.length
    const half = Math.ceil(players.length / 2)

    const pairings = new Array<{ a: T; b: T }>()
    const playerIndexes = players.map((_, i) => i).slice(1)

    for (let i = 0; i < rounds; i++) {
      const newPlayerIndexes = [0].concat(playerIndexes)
      const firstHalf = newPlayerIndexes.slice(0, half)
      const secondHalf = newPlayerIndexes.slice(half, players.length).reverse()
      console.log(firstHalf, secondHalf)

      for (let j = 0; j < firstHalf.length; j++) {
        if (j >= secondHalf.length) continue
        pairings.push({
          a: players[firstHalf[j]],
          b: players[secondHalf[j]],
        })
      }

      // Rotate players
      playerIndexes.push(playerIndexes.shift()!)
    }

    return pairings
  }

  static generatePairs<T>(participants: T[]) {
    const p = Array.from<T | undefined>(participants)
    if (p.length % 2 == 1) p.push(undefined)

    const half = p.length / 2
    const tournamentPairings = []

    const playerIndexes = p.map((_, i) => i).slice(1)

    for (let round = 0; round < p.length - 1; round++) {
      const roundPairings = []

      const newPlayerIndexes = [0].concat(playerIndexes)

      const firstHalf = newPlayerIndexes.slice(0, half)
      const secondHalf = newPlayerIndexes.slice(half, p.length).reverse()

      for (let i = 0; i < firstHalf.length; i++) {
        const a = p[firstHalf[i]]
        const b = p[secondHalf[i]]
        if (!a || !b) continue
        roundPairings.push({ a, b })
      }

      // Rotate players
      playerIndexes.push(playerIndexes.shift()!)
      tournamentPairings.push(roundPairings)
    }

    return tournamentPairings.flat()
  }

  static async generateMatchesForGroup(sessionId: string, groups: Group[], tracks: Track[]) {
    console.debug('Generating matches for', groups.length, 'groups')

    const pairings = groups.map(group => this.generatePairs(group.users))
    const maxPairingsPerGroup = Math.max(...pairings.map(p => p.length))
    const interleavedMatches = new Array<NewMatch>()
    if (tracks.length < maxPairingsPerGroup) throw new Error('Not enough tracks for all pairings')

    console.log(pairings.map(p => p.map(x => x.a?.name + ' vs ' + x.b?.name)))

    for (let i = 0; i < maxPairingsPerGroup; i++) {
      for (const groupPairs of pairings) {
        if (i >= groupPairs.length) continue
        interleavedMatches.push({
          user1: groupPairs[i].a.id,
          user2: groupPairs[i].b.id,
          session: sessionId,
          track: tracks[i].id,
        })
      }
    }

    return await MatchManager.createMany(interleavedMatches)
  }

  static async getGroupDetails(group: Group) {
    console.debug('Getting points for session', group.id)
    const matches = await MatchManager.getAllFromGroup(group.id)
    return {
      ...group,
      users: group.users.map(u => ({
        ...u,
        points: matches.filter(m => m.winner?.id === u.id).length,
      })),
    }
  }

  static generateBracket(groups: Group[], matces: Match[]) {}

  static async clearMatches(sessionId: string) {
    console.debug('Clearing matches for session', sessionId)
    await MatchManager.deleteAllFromSession(sessionId)
  }
}
