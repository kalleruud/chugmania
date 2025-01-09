import GroupManager from './group.manager'
import type { Match, NewMatch } from './match.manager'
import MatchManager from './match.manager'
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
    const groups = await GroupManager.getAllFromSession(sessionId)
    await Promise.all(groups.map(group => GroupManager.delete(group.id)))
  }

  static async scheduleMatches(
    session: string,
    users: string[],
    availableTracks: Track[]
  ): Promise<Match[]> {
    const matches: NewMatch[] = []
    const userLastMatch: Record<string, number> = {}
    const userTrackCount: Record<string, Record<string, number>> = {} // Track count per user per track

    // Generate all pairings
    for (let i = 0; i < users.length; i++) {
      const user1 = users[i]
      for (let j = i + 1; j < users.length; j++) {
        const user2 = users[j]
        matches.push({ user1, user2, session, track: 'todo' })
      }
    }

    // Step 1: Randomly shuffle matches to get an initial schedule
    matches.sort(() => Math.random() - 0.5)

    // Step 2: Schedule matches greedily, maximizing rest time between users and randomly selecting tracks
    const scheduledMatches: NewMatch[] = []

    while (matches.length > 0) {
      // Sort remaining matches by the earliest available time for any user
      matches.sort((a, b) => {
        const lastA = Math.min(
          userLastMatch[a.user1] ?? -Infinity,
          userLastMatch[a.user2] ?? -Infinity
        )
        const lastB = Math.min(
          userLastMatch[b.user1] ?? -Infinity,
          userLastMatch[b.user2] ?? -Infinity
        )
        return lastA - lastB
      })

      const nextMatch = matches.shift()!

      // Step 3: Randomly select a track from the available list
      const selectedTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)].id

      // Assign the selected track to the match
      nextMatch.track = selectedTrack

      scheduledMatches.push(nextMatch)

      // Update the last match times for the users
      const matchIndex = scheduledMatches.length
      userLastMatch[nextMatch.user1] = matchIndex
      userLastMatch[nextMatch.user2] = matchIndex

      // Update the track usage count for the users
      if (!userTrackCount[nextMatch.user1]) userTrackCount[nextMatch.user1] = {}
      if (!userTrackCount[nextMatch.user2]) userTrackCount[nextMatch.user2] = {}

      userTrackCount[nextMatch.user1][selectedTrack] =
        (userTrackCount[nextMatch.user1][selectedTrack] ?? 0) + 1
      userTrackCount[nextMatch.user2][selectedTrack] =
        (userTrackCount[nextMatch.user2][selectedTrack] ?? 0) + 1
    }

    return await MatchManager.createMany(scheduledMatches)
  }

  static async clearMatches(sessionId: string) {
    console.debug('Clearing matches for session', sessionId)
    await MatchManager.deleteAllFromSession(sessionId)
  }
}
