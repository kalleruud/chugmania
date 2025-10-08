import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Socket } from 'socket.io'
import type {
  PlayerDetail,
  PlayerTrackGroup,
  PlayerTrackLap,
} from '../../../common/models/playerDetail'
import type {
  PlayerSummary,
  PlayerTopResult,
} from '../../../common/models/playerSummary'
import { isGetPlayerDetailsRequest } from '../../../common/models/requests'
import type {
  BackendResponse,
  GetPlayerDetailsResponse,
  GetPlayerSummariesResponse,
} from '../../../common/models/responses'
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

    for (const row of userRows) {
      const { passwordHash: _passwordHash, ...rest } = row
      const userInfo: UserInfo = { ...rest, passwordHash: undefined }
      playerMap.set(row.id, { user: userInfo, results: [] })
    }

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
      for (const [index, entry] of group.entries.entries()) {
        if (entry.duration == null) break
        const player = playerMap.get(entry.userId)
        if (!player) break

        player.results.push({
          trackId: group.trackId,
          trackNumber: group.trackNumber,
          trackLevel: group.trackLevel,
          trackType: group.trackType,
          position: index + 1,
          duration: entry.duration,
        })
      }
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

  static async onGetPlayerDetails(
    _socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isGetPlayerDetailsRequest(request))
      throw new Error('Invalid player details request')

    const player = await db.query.users.findFirst({
      where: eq(users.id, request.playerId),
    })
    if (!player) throw new Error('Player not found')

    const playerInfo: UserInfo = {
      ...player,
      passwordHash: undefined,
    }

    const playerEntries = await db
      .select({
        entry: timeEntries,
        track: tracks,
      })
      .from(timeEntries)
      .innerJoin(tracks, eq(timeEntries.track, tracks.id))
      .where(eq(timeEntries.user, request.playerId))
      .orderBy(asc(tracks.number), desc(timeEntries.createdAt))

    const trackIds = Array.from(new Set(playerEntries.map(row => row.track.id)))

    const rankingMap = new Map<
      string,
      {
        track: typeof tracks.$inferSelect
        total: number
        positions: Map<string, number | null>
      }
    >()

    if (trackIds.length > 0) {
      const rankingRows = await db
        .select({
          entryId: timeEntries.id,
          duration: timeEntries.duration,
          track: tracks,
        })
        .from(timeEntries)
        .innerJoin(tracks, eq(timeEntries.track, tracks.id))
        .where(inArray(tracks.id, trackIds))
        .orderBy(
          asc(tracks.number),
          asc(sql`CASE WHEN ${timeEntries.duration} IS NULL THEN 1 ELSE 0 END`),
          asc(timeEntries.duration),
          desc(timeEntries.createdAt)
        )

      let currentTrackId: string | null = null
      let currentPosition = 0

      for (const row of rankingRows) {
        const { track, entryId, duration } = row

        if (track.id !== currentTrackId) {
          currentTrackId = track.id
          currentPosition = 0
        }

        if (!rankingMap.has(track.id)) {
          rankingMap.set(track.id, {
            track,
            total: 0,
            positions: new Map(),
          })
        }

        const record = rankingMap.get(track.id)!
        record.total += 1

        if (duration == null) record.positions.set(entryId, null)
        else {
          currentPosition += 1
          record.positions.set(entryId, currentPosition)
        }
      }
    }

    const groupedTracks = new Map<string, PlayerTrackGroup>()

    for (const row of playerEntries) {
      const { entry, track } = row
      if (!groupedTracks.has(track.id)) {
        groupedTracks.set(track.id, {
          track,
          laps: [],
        })
      }

      const stats = rankingMap.get(track.id)
      const position = stats?.positions.get(entry.id) ?? null
      const total = stats?.total ?? 0

      // Ensure we strip password hash from entry.user (already string)
      const lap: PlayerTrackLap = {
        entry,
        position,
        totalEntries: total,
      }

      groupedTracks.get(track.id)!.laps.push(lap)
    }

    const tracksDetails: PlayerTrackGroup[] = Array.from(
      groupedTracks.values()
    ).map(group => {
      const stats = rankingMap.get(group.track.id)
      const totalEntries = stats?.total ?? group.laps.length

      const laps = group.laps
        .map<PlayerTrackLap>(lap => ({
          entry: lap.entry,
          position: lap.position,
          totalEntries: lap.totalEntries || totalEntries,
        }))
        .sort(
          (a, b) => b.entry.createdAt.getTime() - a.entry.createdAt.getTime()
        )

      return {
        track: group.track,
        laps,
      }
    })

    tracksDetails.sort((a, b) => a.track.number - b.track.number)

    const detail: PlayerDetail = {
      user: playerInfo,
      tracks: tracksDetails,
    }

    return {
      success: true,
      player: detail,
    } satisfies GetPlayerDetailsResponse
  }
}
