import type { Ranking } from '@common/models/ranking'
import type { TimeEntry } from '@common/models/timeEntry'

export type QualificationInputEntry = Pick<
  TimeEntry,
  'id' | 'user' | 'track' | 'session' | 'duration' | 'createdAt' | 'deletedAt'
>

export function computeQualificationOrder(
  participantIds: string[],
  qualificationTrackId: string,
  sessionId: string,
  timeEntries: QualificationInputEntry[],
  rankings: Ranking[]
): { orderedIds: string[]; rankByUser: Map<string, number> } {
  const rankingByUser = new Map(rankings.map(r => [r.user, r] as const))

  const validLaps = timeEntries.filter(
    e =>
      e.track === qualificationTrackId &&
      e.session === sessionId &&
      !e.deletedAt &&
      e.duration != null &&
      e.duration > 0
  )

  const bestByUser = new Map<string, { duration: number; user: string }>()
  for (const e of validLaps) {
    const cur = bestByUser.get(e.user)
    if (!cur || e.duration! < cur.duration) {
      bestByUser.set(e.user, { duration: e.duration!, user: e.user })
    }
  }

  const timed: string[] = []
  const pending: string[] = []
  for (const uid of participantIds) {
    if (bestByUser.has(uid)) timed.push(uid)
    else pending.push(uid)
  }

  timed.sort((a, b) => {
    const da = bestByUser.get(a)!.duration
    const db = bestByUser.get(b)!.duration
    if (da !== db) return da - db
    return a.localeCompare(b)
  })

  pending.sort((a, b) => {
    const ra = rankingByUser.get(a)
    const rb = rankingByUser.get(b)
    const rna = ra?.ranking ?? 1e9
    const rnb = rb?.ranking ?? 1e9
    if (rna !== rnb) return rna - rnb
    const ta = ra?.totalRating ?? 1e9
    const tb = rb?.totalRating ?? 1e9
    if (ta !== tb) return ta - tb
    return a.localeCompare(b)
  })

  const orderedIds = [...timed, ...pending]
  const rankByUser = new Map<string, number>()
  orderedIds.forEach((uid, i) => rankByUser.set(uid, i + 1))
  return { orderedIds, rankByUser }
}
