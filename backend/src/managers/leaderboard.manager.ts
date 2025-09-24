import { asc, desc, eq, sql } from 'drizzle-orm'
import type { Socket } from 'socket.io'
import type { Leaderboard } from '../../../common/models/leaderboard'
import { isGetLeaderboardRequest } from '../../../common/models/requests'
import type {
  BackendResponse,
  GetLeaderboardsResponse,
} from '../../../common/models/responses'
import type { LeaderboardEntryGap } from '../../../common/models/timeEntry'
import type { Track } from '../../../common/models/track'
import db from '../../database/database'
import { timeEntries, tracks, users } from '../../database/schema'
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
      .orderBy(
        asc(sql`CASE WHEN ${timeEntries.duration} IS NULL THEN 1 ELSE 0 END`),
        asc(timeEntries.duration),
        desc(timeEntries.createdAt)
      )

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
      const prev = i > 0 ? arr[i - 1]!.entry.duration : null
      const next = i < arr.length - 1 ? arr[i + 1]!.entry.duration : null

      const gap: LeaderboardEntryGap = { position: i + 1 }
      // Round gaps to nearest hundredth (10 ms) to avoid off-by-one issues
      const roundToHundredth = (ms: number) => Math.round(ms / 10) * 10
      if (r.entry.duration && prev !== null)
        gap.previous = roundToHundredth(r.entry.duration - prev)
      if (
        r.entry.duration &&
        leaderDuration !== null &&
        i > 0 &&
        leaderDuration !== undefined
      )
        gap.leader = roundToHundredth(r.entry.duration - leaderDuration)
      if (r.entry.duration && next !== null)
        gap.next = roundToHundredth(next - r.entry.duration)

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
      leaderboards: [await LeaderboardManager.getLeaderboard(request.trackId)],
    } satisfies GetLeaderboardsResponse
  }
}
