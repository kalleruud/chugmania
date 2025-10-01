import { asc, desc, eq, sql } from 'drizzle-orm'
import type {
  BackendResponse,
  GetPlayerSummariesResponse,
} from '../../../common/models/responses'
import type { PlayerSummary, PlayerTopResult } from '../../../common/models/playerSummary'
import type { UserInfo } from '../../../common/models/user'
import db from '../../database/database'
import { timeEntries, tracks, users } from '../../database/schema'

type PlayerAccumulator = {
  user: UserInfo
  results: PlayerTopResult[]
}

type TrackAccumulator = {
  trackId: string
  trackNumber: number
  trackLevel: (typeof tracks.$inferSelect)['level']
  trackType: (typeof tracks.$inferSelect)['type']
  entries: {
    userId: string
    duration: number | null
  }[]
}

export default class PlayerManager {
  static async onGetPlayerSummaries(): Promise<BackendResponse> {
    const userRows = await db.select().from(users)
    const playerMap = new Map<string, PlayerAccumulator>()

    userRows.forEach(row => {
      const { passwordHash: _passwordHash, ...rest } = row
      const userInfo: UserInfo = { ...rest, passwordHash: undefined }
      playerMap.set(row.id, { user: userInfo, results: [] })
    })

    const lapRows = await db
      .select({
        entryId: timeEntries.id,
        duration: timeEntries.duration,
        createdAt: timeEntries.createdAt,
        trackId: tracks.id,
        trackNumber: tracks.number,
        trackLevel: tracks.level,
        trackType: tracks.type,
        userId: users.id,
      })
      .from(timeEntries)
      .innerJoin(tracks, eq(timeEntries.track, tracks.id))
      .innerJoin(users, eq(timeEntries.user, users.id))
      .orderBy(
        asc(tracks.number),
        asc(tracks.id),
        asc(sql`CASE WHEN ${timeEntries.duration} IS NULL THEN 1 ELSE 0 END`),
        asc(timeEntries.duration),
        desc(timeEntries.createdAt)
      )

    const trackGroups: TrackAccumulator[] = []
    let currentTrackId: string | null = null
    let currentGroup: TrackAccumulator | null = null
    let seenUsersForTrack = new Set<string>()

    for (const row of lapRows) {
      if (row.trackId !== currentTrackId) {
        currentTrackId = row.trackId
        currentGroup = {
          trackId: row.trackId,
          trackNumber: row.trackNumber,
          trackLevel: row.trackLevel,
          trackType: row.trackType,
          entries: [],
        }
        trackGroups.push(currentGroup)
        seenUsersForTrack = new Set<string>()
      }

      if (seenUsersForTrack.has(row.userId)) continue
      seenUsersForTrack.add(row.userId)

      currentGroup?.entries.push({
        userId: row.userId,
        duration: row.duration,
      })
    }

    for (const group of trackGroups) {
      group.entries.forEach((entry, index) => {
        if (entry.duration == null) return
        const player = playerMap.get(entry.userId)
        if (!player) return

        player.results.push({
          trackId: group.trackId,
          trackNumber: group.trackNumber,
          trackLevel: group.trackLevel,
          trackType: group.trackType,
          position: index + 1,
          duration: entry.duration,
        })
      })
    }

    const players: PlayerSummary[] = Array.from(playerMap.values()).map(
      ({ user, results }) => {
        const sorted = [...results].sort((a, b) => a.position - b.position)
        const totalTracks = results.length
        const averagePosition =
          totalTracks === 0
            ? null
            : Number(
                (
                  results.reduce((sum, r) => sum + r.position, 0) / totalTracks
                ).toFixed(2)
              )

        return {
          user,
          totalTracks,
          averagePosition,
          topResults: sorted.slice(0, 3),
        }
      }
    )

    players.sort((a, b) => {
      const aAvg = a.averagePosition ?? Number.POSITIVE_INFINITY
      const bAvg = b.averagePosition ?? Number.POSITIVE_INFINITY
      if (aAvg !== bAvg) return aAvg - bAvg
      if (a.totalTracks !== b.totalTracks) return b.totalTracks - a.totalTracks
      return a.user.firstName.localeCompare(b.user.firstName)
    })

    return {
      success: true,
      players,
    } satisfies GetPlayerSummariesResponse
  }
}
