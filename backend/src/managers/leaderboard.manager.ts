import type { Leaderboard } from '@chugmania/common/models/leaderboard.js'
import { isGetLeaderboardRequest } from '@chugmania/common/models/requests.js'
import type {
  BackendResponse,
  GetLeaderboardsResponse,
} from '@chugmania/common/models/responses.js'
import type { LeaderboardEntryGap } from '@chugmania/common/models/timeEntry.js'
import type { Track } from '@chugmania/common/models/track.js'
import db from '@database/database'
import { timeEntries, tracks, users } from '@database/schema'
import { asc, eq } from 'drizzle-orm'
import type { Socket } from 'socket.io'
import TrackManager from './track.manager'

export default class LeaderboardManager {
  private static async getLeaderboard(
    trackId: Track['id'],
    offset = 0,
    limit = 100
  ): Promise<Leaderboard> {
    const track = await db.query.tracks.findFirst({
      where: eq(tracks.id, trackId),
    })
    if (!track) throw new Error(`Track not found: ${trackId}`)

    const rows = await db
      .select()
      .from(timeEntries)
      .innerJoin(users, eq(users.id, timeEntries.user))
      .where(eq(timeEntries.track, trackId))
      .orderBy(asc(timeEntries.duration))

    const totalEntries = rows.length

    // Keep best (lowest duration) per user, rows already sorted asc by duration
    const seen = new Set<string>()
    const best = rows
      .filter(r => {
        const uid = r.users.id
        if (seen.has(uid)) return false
        seen.add(uid)
        return true
      })
      .map(r => ({ entry: r.time_entries, user: r.users }))

    // Compute gaps against previous and leader
    const leaderDuration = best[0]?.entry.duration
    const withGaps = best.map((r, i, arr) => {
      const prev = i > 0 ? arr[i - 1]!.entry.duration : undefined
      const next = i < arr.length - 1 ? arr[i + 1]!.entry.duration : undefined

      const gap: LeaderboardEntryGap = { position: i + 1 }
      if (prev !== undefined) gap.previous = r.entry.duration - prev
      if (i > 0 && leaderDuration !== undefined)
        gap.leader = r.entry.duration - leaderDuration
      if (next !== undefined) gap.next = next - r.entry.duration

      const userInfo = { ...r.user, passwordHash: undefined }
      return {
        id: r.entry.id,
        duration: r.entry.duration,
        amount: r.entry.amount,
        comment: r.entry.comment,
        createdAt: r.entry.createdAt,
        updatedAt: r.entry.updatedAt,
        deletedAt: r.entry.deletedAt,
        user: userInfo,
        gap,
      }
    })

    const entries = withGaps.slice(offset, offset + limit)

    return {
      track,
      totalEntries,
      entries,
    }
  }

  private static async getLeaderboardSummaries(
    offset = 0,
    limit = 100
  ): Promise<Leaderboard[]> {
    const trackRows = await TrackManager.getTrackIdsWithLapTimes(offset, limit)

    return Promise.all(
      trackRows.map(id => LeaderboardManager.getLeaderboard(id, 0, 3))
    )
  }

  static async onGetLeaderboardSummaries(
    socket: Socket
  ): Promise<GetLeaderboardsResponse> {
    console.debug(
      new Date().toISOString(),
      socket.id,
      'Received getLeaderboardSummaries request'
    )

    return {
      success: true,
      leaderboards: await LeaderboardManager.getLeaderboardSummaries(0, 1000),
    }
  }

  static async onGetLeaderboard(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isGetLeaderboardRequest(request)) {
      throw Error('Failed to fetch leaderboard')
    }

    console.debug(
      new Date().toISOString(),
      socket.id,
      'Received getLeaderboard request'
    )

    return {
      success: true,
      leaderboards: [
        await LeaderboardManager.getLeaderboard(
          request.trackId,
          request.offset ?? 0,
          100
        ),
      ],
    } satisfies GetLeaderboardsResponse
  }
}
