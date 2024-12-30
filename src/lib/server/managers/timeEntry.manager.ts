import db from '$lib/server/db'
import { and, eq, isNull } from 'drizzle-orm'
import { timeEntries } from '../db/schema'
import TrackManager, { type Track } from './track.manager'
import UserManager, { type PublicUser } from './user.manager'

type TimeEntrySelect = typeof timeEntries.$inferSelect
export type TimeEntry = Omit<TimeEntrySelect, 'track' | 'user'> & {
  track: Track
  user: PublicUser
  readableDuration: string
  leaderGap?: number
  readableLeaderGap?: string
  gap?: number
  readableGap?: string
}

export default class TimeEntryManager {
  static readonly table = timeEntries

  static async getBySession(sessionId: string): Promise<TimeEntry[]> {
    console.debug('Getting time entries for session:', sessionId)
    const items = await db
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.session, sessionId), isNull(timeEntries.deletedAt)))
      .innerJoin(TrackManager.table, eq(timeEntries.track, TrackManager.table.id))
      .innerJoin(UserManager.table, eq(timeEntries.user, UserManager.table.id))
      .orderBy(timeEntries.track, timeEntries.duration)

    return items.map(item => ({
      ...this.getDetails(item.time_entries),
      track: TrackManager.getDetails(item.tracks),
      user: UserManager.getDetails(item.users),
    }))
  }

  static async create(timeEntry: typeof timeEntries.$inferInsert) {
    console.debug('Creating time entry')
    return await db.insert(timeEntries).values(timeEntry).returning()
  }

  static getDetails(timeEntry: TimeEntrySelect) {
    return {
      ...timeEntry,
      readableDuration: TimeEntryManager.toString(timeEntry.duration),
    }
  }

  static getDurationGaps<T extends { duration: number }>(
    timeEntries: T[]
  ): (T & { gap?: number; readableGap?: string })[] {
    return timeEntries.map((entry, i) => {
      if (i === 0) return entry
      const leader = timeEntries[0]
      const previous = timeEntries[i - 1]

      const gap = entry.duration - previous.duration
      const readableGap = TimeEntryManager.toGapString(gap)

      const leaderGap = entry.duration - leader.duration
      const readableLeaderGap = TimeEntryManager.toGapString(leaderGap)

      return { ...entry, gap, readableGap, leaderGap, readableLeaderGap }
    })
  }

  static toMs(minutes: number, seconds: number, houndreds: number) {
    return minutes * 60_000 + seconds * 1000 + houndreds * 10
  }

  static toString(ms: number) {
    const abs = Math.abs(ms)
    const minutes = Math.floor(abs / 60_000)
    const seconds = Math.floor((abs % 60_000) / 1000)
    const houndreds = Math.floor((abs % 1000) / 10)
    return `${ms < 0 ? '-' : ''}${minutes}:${seconds.toString().padStart(2, '0')}.${houndreds.toString().padStart(2, '0')}`
  }

  static toGapString(ms: number) {
    const oneMinute = 60_000

    const abs = Math.abs(ms)
    const minutes = Math.floor(abs / oneMinute)
    const seconds = Math.floor((abs % oneMinute) / 1000)
    const houndreds = Math.floor((abs % 1000) / 10)

    let out = ms < 0 ? '-' : '+'
    if (ms >= oneMinute) out += `${minutes}:`
    if (ms >= oneMinute) out += seconds.toString().padStart(2, '0')
    else out += seconds

    return out + `.${houndreds.toString().padStart(2, '0')}`
  }
}
