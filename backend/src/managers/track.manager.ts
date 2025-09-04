import type { TopTime, TrackSummary } from '@chugmania/common/models/track.js'
import { tryCatchAsync } from '@chugmania/common/utils/try-catch.js'
import db from '@database/database'
import {
  type TrackLevel,
  type TrackType,
  timeEntries,
  tracks,
  users,
} from '@database/schema'
import { asc, count, eq } from 'drizzle-orm'
import UserManager from './user.manager'

export default class TrackManager {
  static async seed(): Promise<void> {
    const { data, error } = await tryCatchAsync(db.query.tracks.findFirst())
    if (error) throw error
    if (data) return

    const trackCount = 200
    const levels: TrackLevel[] = ['white', 'green', 'blue', 'red', 'black']
    const types: TrackType[] = ['drift', 'valley', 'lagoon', 'stadium']
    const items: (typeof tracks.$inferInsert)[] = []
    for (let i = 0; i < trackCount; i++) {
      items.push({
        number: i + 1,
        level: levels[Math.floor(i / 40) % levels.length]!,
        type: types[Math.floor(i / 10) % types.length]!,
      })
    }
    await db.insert(tracks).values(items)
    console.log(`Inserted ${trackCount} tracks`)
  }

  private static async buildSummary(
    t: typeof tracks.$inferSelect
  ): Promise<TrackSummary> {
    const topQuery = db
      .select()
      .from(timeEntries)
      .leftJoin(users, eq(users.id, timeEntries.user))
      .where(eq(timeEntries.track, t.id))
      .orderBy(asc(timeEntries.duration))
      .limit(3)

    const countQuery = db
      .select({ value: count() })
      .from(timeEntries)
      .where(eq(timeEntries.track, t.id))

    const [
      { data: topRows, error: topError },
      { data: countRows, error: countError },
    ] = await Promise.all([tryCatchAsync(topQuery), tryCatchAsync(countQuery)])

    if (topError) throw topError
    if (countError) throw countError

    const topTimes: TopTime[] = (topRows ?? []).map(r => ({
      timeEntry: r.time_entries,
      user: UserManager.toUserInfo(r.users!),
    }))

    const lapCount = countRows?.[0]?.value ?? 0

    return {
      track: t,
      lapCount,
      topTimes,
    }
  }

  static async getTracks(): Promise<TrackSummary[]> {
    const { data, error } = await tryCatchAsync(
      db.select().from(tracks).orderBy(asc(tracks.number))
    )

    if (error) throw error
    const rows = data ?? []
    const summaries: TrackSummary[] = []
    for (const t of rows) {
      summaries.push(await this.buildSummary(t))
    }
    return summaries
  }

  static async getTrack(id: string): Promise<TrackSummary> {
    const { data, error } = await tryCatchAsync(
      db.query.tracks.findFirst({ where: eq(tracks.id, id) })
    )

    if (error) throw error
    if (!data) throw Error(`Couldn't find track with id ${id}`)

    return this.buildSummary(data)
  }

  static async getLeaderboard(
    id: string,
    offset = 0,
    limit = 100
  ): Promise<TopTime[]> {
    const { data, error } = await tryCatchAsync(
      db
        .select()
        .from(timeEntries)
        .leftJoin(users, eq(users.id, timeEntries.user))
        .where(eq(timeEntries.track, id))
    )

    if (error) throw error

    const rows = data ?? []
    const best = new Map<string, TopTime>()
    for (const r of rows) {
      if (!r.users) {
        throw new Error('User not found for time entry')
      }
      const existing = best.get(r.users.id)
      if (!existing || r.time_entries.duration < existing.timeEntry.duration) {
        best.set(r.users.id, {
          user: UserManager.toUserInfo(r.users),
          timeEntry: r.time_entries,
        })
      }
    }

    const sorted = Array.from(best.values()).sort(
      (a, b) => a.timeEntry.duration - b.timeEntry.duration
    )
    return sorted.slice(offset, offset + limit)
  }
}
