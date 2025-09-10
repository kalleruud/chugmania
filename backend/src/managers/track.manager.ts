import type { SearchTracksRequest } from '@chugmania/common/models/requests.js'
import type {
  BackendResponse,
  GetTracksResponse,
} from '@chugmania/common/models/responses.js'
import { TRACK_LEVELS, TRACK_TYPES } from '@chugmania/common/models/track.ts'
import { tryCatchAsync } from '@chugmania/common/utils/try-catch.js'
import db from '@database/database'
import { timeEntries, tracks } from '@database/schema'
import { asc, eq } from 'drizzle-orm'
import type { Socket } from 'socket.io'

export default class TrackManager {
  static async seed(): Promise<void> {
    const { data, error } = await tryCatchAsync(db.query.tracks.findFirst())
    if (error) throw error
    if (data) return

    const trackCount = 200

    const items: (typeof tracks.$inferInsert)[] = []
    for (let i = 0; i < trackCount; i++) {
      items.push({
        number: i + 1,
        level: TRACK_LEVELS.filter(t => t != 'custom')[
          Math.floor(i / 40) % (TRACK_LEVELS.length - 1)
        ]!,
        type: TRACK_TYPES[Math.floor(i / 10) % TRACK_TYPES.length]!,
      })
    }
    await db.insert(tracks).values(items)
    console.log(`Inserted ${trackCount} tracks`)
  }

  static async getTrackIdsWithLapTimes(
    offset = 0,
    limit = 100
  ): Promise<string[]> {
    const { data, error } = await tryCatchAsync(
      db
        .select({ id: tracks.id })
        .from(tracks)
        .innerJoin(timeEntries, eq(tracks.id, timeEntries.track))
        .groupBy(tracks.id)
        .orderBy(asc(tracks.number))
        .offset(offset)
        .limit(limit)
    )

    if (error) throw error
    return data.map(d => d.id)
  }

  static async onGetTracks(s: Socket, req?: unknown): Promise<BackendResponse> {
    const { q, limit = 200 } = (req as SearchTracksRequest) ?? { q: '' }
    const trimmed = (q ?? '').trim()

    // If query looks like a number or #number, match by exact number; else return first N ordered by number
    const numMatch = trimmed.replace(/^#/, '')
    const num = /^\d+$/.test(numMatch) ? parseInt(numMatch, 10) : null

    const { data, error } = await tryCatchAsync(
      db
        .select({
          id: tracks.id,
          number: tracks.number,
          level: tracks.level,
          type: tracks.type,
          isChuggable: tracks.isChuggable,
          createdAt: tracks.createdAt,
          updatedAt: tracks.updatedAt,
          deletedAt: tracks.deletedAt,
        })
        .from(tracks)
        .where(num !== null ? eq(tracks.number, num) : undefined)
        .orderBy(asc(tracks.number))
        .limit(limit)
    )

    if (error) throw error
    return { success: true, tracks: data } satisfies GetTracksResponse
  }
}
