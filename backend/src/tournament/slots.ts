import type { SlotDependency } from '@common/models/tournament'
import type { StandingRow } from './standings'

export type MatchRowLite = {
  id: string
  user1: string | null
  user2: string | null
  winner: string | null
  status: 'planned' | 'completed' | 'cancelled'
}

export function resolveSlotValue(
  dep: SlotDependency | null,
  ctx: {
    standingsByGroupId: Map<string, StandingRow[]>
    groupComplete: Map<string, boolean>
    matchById: Map<string, MatchRowLite>
  }
): string | null {
  if (!dep) return null
  if (dep.kind === 'group_rank') {
    if (!ctx.groupComplete.get(dep.groupId)) return null
    const rows = ctx.standingsByGroupId.get(dep.groupId)
    if (!rows) return null
    const row = rows.find(r => r.rank === dep.rank)
    return row?.userId ?? null
  }
  if (dep.kind === 'match_winner') {
    const m = ctx.matchById.get(dep.matchId)
    if (!m || m.status !== 'completed' || !m.winner) return null
    return m.winner
  }
  if (dep.kind === 'match_loser') {
    const m = ctx.matchById.get(dep.matchId)
    if (!m || m.status !== 'completed' || !m.winner || !m.user1 || !m.user2)
      return null
    return m.winner === m.user1 ? m.user2 : m.user1
  }
  return null
}

export function groupPlayComplete(
  groupId: string,
  groupUserIds: string[],
  groupStageMatches: MatchRowLite[]
): boolean {
  const expectedPairs = (groupUserIds.length * (groupUserIds.length - 1)) / 2
  const relevant = groupStageMatches.filter(
    m =>
      m.user1 &&
      m.user2 &&
      groupUserIds.includes(m.user1) &&
      groupUserIds.includes(m.user2)
  )
  if (relevant.length < expectedPairs) return false
  for (const m of relevant) {
    if (m.status !== 'completed' || !m.winner) return false
  }
  return true
}
