import type { Match } from '@common/models/match'
import type { Session } from '@common/models/session'
import type { TimeEntry } from '@common/models/timeEntry'

export type ChugMode = 'average' | 'best'

export type ChugTime = {
  user: string
  durationMs: number
}

type Chug = ChugTime & {
  session: string | null
}

type ChugCandidate = {
  user: string | null
  durationMs: number | null
  session: string | null
  status: TimeEntry['status']
}

const AVERAGE_SESSION_COUNT = 3

function getChugs(timeEntries: TimeEntry[], matches: Match[]): Chug[] {
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

function getBest(chugs: Chug[]): number {
  return Math.min(...chugs.map(chug => chug.durationMs))
}

function getRecentAverage(
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
    .toSorted((a, b) => (sessionDates.get(b) ?? 0) - (sessionDates.get(a) ?? 0))
    .slice(0, AVERAGE_SESSION_COUNT)
  const recent = chugs.filter(
    chug => chug.session && recentSessions.includes(chug.session)
  )
  if (recent.length === 0) return undefined
  const total = recent.reduce((sum, chug) => sum + chug.durationMs, 0)
  return Math.round(total / recent.length)
}

export function getChugLeaderboard(
  timeEntries: TimeEntry[],
  matches: Match[],
  sessions: Pick<Session, 'id' | 'date'>[],
  mode: ChugMode
): ChugTime[] {
  const sessionDates = new Map(
    sessions.map(session => [session.id, new Date(session.date).getTime()])
  )
  const chugsByUser = new Map<string, Chug[]>()
  for (const chug of getChugs(timeEntries, matches))
    chugsByUser.set(chug.user, [...(chugsByUser.get(chug.user) ?? []), chug])

  return [...chugsByUser.entries()]
    .flatMap(([user, chugs]) => {
      const durationMs =
        mode === 'best' ? getBest(chugs) : getRecentAverage(chugs, sessionDates)
      return durationMs === undefined ? [] : [{ user, durationMs }]
    })
    .toSorted((a, b) => a.durationMs - b.durationMs)
}
