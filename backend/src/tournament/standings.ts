export type StandingMatch = {
  user1: string | null
  user2: string | null
  winner: string | null
  status: 'planned' | 'completed' | 'cancelled'
}

export type StandingRow = {
  userId: string
  rank: number
  wins: number
  losses: number
  qualificationRank: number
  qualifies: boolean
}

export function computeGroupStandings(
  groupUserIds: string[],
  groupMatches: StandingMatch[],
  qualificationRank: Map<string, number>,
  advancementCount: number
): StandingRow[] {
  const wins = new Map<string, number>()
  const losses = new Map<string, number>()
  for (const u of groupUserIds) {
    wins.set(u, 0)
    losses.set(u, 0)
  }

  for (const m of groupMatches) {
    if (m.status !== 'completed' || !m.winner || !m.user1 || !m.user2) continue
    if (!groupUserIds.includes(m.user1) || !groupUserIds.includes(m.user2))
      continue
    const loser = m.winner === m.user1 ? m.user2 : m.user1
    wins.set(m.winner, (wins.get(m.winner) ?? 0) + 1)
    losses.set(loser, (losses.get(loser) ?? 0) + 1)
  }

  const rows = groupUserIds.map(userId => ({
    userId,
    wins: wins.get(userId) ?? 0,
    losses: losses.get(userId) ?? 0,
    qualificationRank: qualificationRank.get(userId) ?? 1e9,
  }))

  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    if (a.losses !== b.losses) return a.losses - b.losses
    return a.qualificationRank - b.qualificationRank
  })

  return rows.map((r, idx) => ({
    userId: r.userId,
    rank: idx + 1,
    wins: r.wins,
    losses: r.losses,
    qualificationRank: r.qualificationRank,
    qualifies: idx + 1 <= advancementCount,
  }))
}
