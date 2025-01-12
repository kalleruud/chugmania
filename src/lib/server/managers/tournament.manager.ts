import type { Session } from '@/components/types.server'
import GroupManager, { type Group } from './group.manager'
import MatchManager, { type Match, type NewMatch } from './match.manager'
import type { Track } from './track.manager'
import type { PublicUser } from './user.manager'

export type BracketRound = Partial<Match> & {
  user1LastMatch: Partial<Match> | undefined
  user2LastMatch: Partial<Match> | undefined
}

export default class TournamentManager {
  static readonly finalNames = [
    'Sekstendelsfinale',
    'Åttenedelsfinale',
    'Kvartfinale',
    'Bronsefinale',
    'Semifinale',
    'Finale',
  ]

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
    const users = group.users.map(u => ({
      ...u,
      wins: matches.filter(m => m.winner?.id === u.id).length,
      played: matches.filter(m => (m.user1.id === u.id || m.user2.id === u.id) && m.winner).length,
      playedAll:
        matches.filter(m => (m.user1.id === u.id || m.user2.id === u.id) && m.winner).length >=
        group.users.length - 1,
    }))

    users.sort((a, b) => b.wins - a.wins)

    return {
      ...group,
      users,
    }
  }

  private static async generateBracketRound(
    session: Session,
    matches: BracketRound[],
    track: Track,
    loserBracketMatches?: BracketRound[],
    extraLosers?: (PublicUser | undefined)[],
    doubleElimination: boolean = true
  ): Promise<{
    winnerMatches: BracketRound[]
    loserMatches: BracketRound[][] | undefined
  }> {
    if (matches.length === 1) {
      return {
        winnerMatches: [
          {
            user1: matches[0].winner,
            user1LastMatch: matches[0],
            user2: loserBracketMatches?.[0].winner ?? extraLosers?.[0],
            user2LastMatch: loserBracketMatches?.[0],
            session,
            track,
          },
        ],
        loserMatches: undefined,
      }
    }

    const winnerMatches: BracketRound[] = []
    let loserMatches: BracketRound[][] | undefined = []
    for (let i = 0; i < matches.length; i += 2) {
      winnerMatches.push({
        user1: matches[i].winner,
        user1LastMatch: matches[i],
        user2: matches[i + 1].winner,
        user2LastMatch: matches[i + 1],
        session,
        track,
      })
      if (!doubleElimination) {
        loserMatches = undefined
        continue
      }

      loserMatches?.push([
        {
          user1:
            matches[i].user1?.id === matches[i].winner?.id ? matches[i].user2 : matches[i].user1,
          user1LastMatch: matches[i],
          user2: loserBracketMatches?.[i].winner ?? extraLosers?.[i],
          user2LastMatch: loserBracketMatches?.[i],
          session,
          track,
        },
        {
          user1:
            matches[i].user2?.id === matches[i].winner?.id ? matches[i].user1 : matches[i].user2,
          user1LastMatch: matches[i],
          user2: loserBracketMatches?.[i].winner ?? extraLosers?.[i],
          user2LastMatch: loserBracketMatches?.[i],
          session,
          track,
        },
      ])
    }

    if (loserMatches && !extraLosers && loserMatches.length > winnerMatches.length) {
      loserMatches.push(
        (await this.generateBracketRound(session, loserMatches.at(-1), track, [], [], false))
          .winnerMatches
      )
    }

    return { winnerMatches, loserMatches }
  }

  static pairFinalists(
    session: Session,
    groups: Awaited<ReturnType<typeof this.getGroupDetails>>[],
    track: Track
  ) {
    const finishedGroups = groups.filter(g => g.users.every(u => u.playedAll))
    const first = finishedGroups.map(g => g.users[0])
    const second = finishedGroups.map(g => g.users[1])
    second.push(second.shift()!)

    return first.map(
      (p1, i) =>
        ({
          user1: p1,
          user1LastMatch: undefined,
          user2: second[i],
          user2LastMatch: undefined,
          session,
          track,
        }) satisfies BracketRound
    )
  }

  static async generateBracket(session: Session, groups: Group[], allTracks: Track[]) {
    const trackStack = [...allTracks]
    const finalists = await Promise.all(groups.map(this.getGroupDetails))
    const pairs = this.pairFinalists(session, finalists, trackStack.pop()!)
    trackStack.push(trackStack.shift()!)
    const thirdPlaceUsers = groups.map(g => g.users.at(0))

    const bracketMatches = [
      await this.generateBracketRound(session, pairs, trackStack[0], [], thirdPlaceUsers),
    ]
    const returnThis = [bracketMatches[0].winnerMatches]
    if (bracketMatches[0].loserMatches) returnThis.push(bracketMatches[0].loserMatches.flat())

    while (bracketMatches.at(-1)?.winnerMatches?.length > 1) {
      console.log('Generating next round')
      const { winnerMatches, loserMatches } = bracketMatches.at(-1)!

      const newMatches = await this.generateBracketRound(
        session,
        winnerMatches,
        trackStack[0],
        loserMatches?.[loserMatches.length - 1]
      )
      bracketMatches.push(newMatches)
      trackStack.push(trackStack.shift()!)
      returnThis.push(newMatches.winnerMatches)
      if (newMatches.loserMatches) returnThis.push(newMatches.loserMatches.flat())
    }

    return returnThis.flat()
  }

  static async clearMatches(sessionId: string) {
    console.debug('Clearing matches for session', sessionId)
    await MatchManager.deleteAllFromSession(sessionId)
  }
}
