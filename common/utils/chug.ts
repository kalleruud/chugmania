import type { Match } from '@common/models/match'
import type { TimeEntry } from '@common/models/timeEntry'

export type ChugTime = {
  user: string
  durationMs: number
}

type ChugCandidate = {
  user: string | null
  durationMs: number | null
  status: TimeEntry['status']
}

function getChugCandidates(
  timeEntries: TimeEntry[],
  matches: Match[]
): ChugCandidate[] {
  return [
    ...timeEntries.map(entry => ({
      user: entry.user,
      durationMs: entry.chugDurationMs,
      status: entry.status,
    })),
    ...matches.flatMap(match => [
      {
        user: match.user1,
        durationMs: match.user1ChugDurationMs,
        status: match.status,
      },
      {
        user: match.user2,
        durationMs: match.user2ChugDurationMs,
        status: match.status,
      },
    ]),
  ]
}

export function getChugLeaderboard(
  timeEntries: TimeEntry[],
  matches: Match[]
): ChugTime[] {
  const best = new Map<string, number>()
  for (const { user, durationMs, status } of getChugCandidates(
    timeEntries,
    matches
  )) {
    if (!user || !durationMs || status !== 'completed') continue
    const current = best.get(user)
    if (current === undefined || durationMs < current)
      best.set(user, durationMs)
  }

  return [...best.entries()]
    .map(([user, durationMs]) => ({ user, durationMs }))
    .toSorted((a, b) => a.durationMs - b.durationMs)
}
