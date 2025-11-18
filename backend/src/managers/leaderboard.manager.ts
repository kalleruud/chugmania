import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import type {
  Leaderboard,
  LeaderboardBroadcast,
} from '../../../common/models/leaderboard'
import type { LeaderboardEntryGap } from '../../../common/models/timeEntry'
import type { Track } from '../../../common/models/track'
import db from '../../database/database'
import { timeEntries, tracks, users } from '../../database/schema'
import TrackManager from './track.manager'

export default class LeaderboardManager {
  private static async getLeaderboard(
    trackId: Track['id']
  ): Promise<Leaderboard> {
    const track = await db.query.tracks.findFirst({
      where: eq(tracks.id, trackId),
    })
    if (!track) throw new Error(`Track not found: ${trackId}`)

    const rows = await db
      .select()
      .from(timeEntries)
      .innerJoin(users, eq(users.id, timeEntries.user))
      .where(
        and(
          eq(timeEntries.track, trackId),
          isNull(timeEntries.deletedAt),
          isNull(users.deletedAt)
        )
      )
      .orderBy(
        asc(sql`CASE WHEN ${timeEntries.duration} IS NULL THEN 1 ELSE 0 END`),
        asc(timeEntries.duration),
        desc(timeEntries.createdAt)
      )

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
    const entries = best.map((r, i, arr) => {
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

      return {
        ...r.entry,
        user: r.user.id,
        gap,
      } satisfies Leaderboard['entries'][0]
    })

    return {
      id: trackId,
      entries,
    }
  }

  static async onEmitLeaderboards(): Promise<LeaderboardBroadcast> {
    const tracks = await TrackManager.onEmitTracks()
    return (
      await Promise.all(
        tracks.map(track => LeaderboardManager.getLeaderboard(track.id))
      )
    ).filter(lb => lb.entries.length > 0)
  }
}
