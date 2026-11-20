import type { ChugTime, ChugTimes } from '@common/models/chugTime'
import type { EntryStatus } from '@common/models/entry'
import { isNull } from 'drizzle-orm'
import db from '../../database/database'
import { sessions } from '../../database/schema'
import { broadcast } from '../server'
import MatchManager from './match.manager'
import TimeEntryManager from './timeEntry.manager'

type Chug = ChugTime & {
  session: string | null
}

type ChugCandidate = {
  user: string | null
  durationMs: number | null
  session: string | null
  status: EntryStatus
}

const AVERAGE_SESSION_COUNT = 3

export default class ChugTimeManager {
  static async getChugTimes(): Promise<ChugTimes> {
    const chugsByUser = new Map<string, Chug[]>()
    for (const chug of await ChugTimeManager.getChugs()) {
      const chugs = chugsByUser.get(chug.user) ?? []
      chugs.push(chug)
      chugsByUser.set(chug.user, chugs)
    }
    const sessionDates = ChugTimeManager.getSessionDates()

    return {
      average: ChugTimeManager.rank(chugsByUser, chugs =>
        ChugTimeManager.getRecentAverage(chugs, sessionDates)
      ),
      best: ChugTimeManager.rank(chugsByUser, chugs =>
        Math.min(...chugs.map(chug => chug.durationMs))
      ),
    }
  }

  static async publish(): Promise<void> {
    broadcast('all_chug_times', await ChugTimeManager.getChugTimes())
  }

  private static async getChugs(): Promise<Chug[]> {
    const [timeEntries, matches] = await Promise.all([
      TimeEntryManager.getAllTimeEntries(),
      MatchManager.getAllMatches(),
    ])
    const candidates: ChugCandidate[] = [
      ...timeEntries.map(entry => ({
        user: entry.user,
        durationMs: entry.chugDurationMs,
        session: entry.session,
        status: entry.status,
      })),
      ...matches.flatMap(match => [
        {
          user: match.user1,
          durationMs: match.user1ChugDurationMs,
          session: match.session,
          status: match.status,
        },
        {
          user: match.user2,
          durationMs: match.user2ChugDurationMs,
          session: match.session,
          status: match.status,
        },
      ]),
    ]
    return candidates.flatMap(({ user, durationMs, session, status }) =>
      user && durationMs && status === 'completed'
        ? [{ user, durationMs, session }]
        : []
    )
  }

  private static getSessionDates(): Map<string, number> {
    const rows = db
      .select({ id: sessions.id, date: sessions.date })
      .from(sessions)
      .where(isNull(sessions.deletedAt))
      .all()
    return new Map(rows.map(row => [row.id, row.date?.getTime() ?? 0]))
  }

  private static getRecentAverage(
    chugs: Chug[],
    sessionDates: Map<string, number>
  ): number | undefined {
    const recentSessions = [
      ...new Set(
        chugs.flatMap(chug =>
          chug.session && sessionDates.has(chug.session) ? [chug.session] : []
        )
      ),
    ]
      .toSorted(
        (a, b) => (sessionDates.get(b) ?? 0) - (sessionDates.get(a) ?? 0)
      )
      .slice(0, AVERAGE_SESSION_COUNT)
    const recent = chugs.filter(
      chug => chug.session && recentSessions.includes(chug.session)
    )
    if (recent.length === 0) return undefined
    const total = recent.reduce((sum, chug) => sum + chug.durationMs, 0)
    return Math.round(total / recent.length)
  }

  private static rank(
    chugsByUser: Map<string, Chug[]>,
    getDuration: (chugs: Chug[]) => number | undefined
  ): ChugTime[] {
    return [...chugsByUser.entries()]
      .flatMap(([user, chugs]) => {
        const durationMs = getDuration(chugs)
        return durationMs === undefined ? [] : [{ user, durationMs }]
      })
      .toSorted((a, b) => a.durationMs - b.durationMs)
  }
}
