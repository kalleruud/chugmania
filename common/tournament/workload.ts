import type { EliminationType } from '../../backend/database/schema'

export type TournamentWorkloadSummary = {
  distinctTrackCount: number
  qualificationLapsPerPlayer: { min: number; max: number }
  tournamentMatchesPerPlayer: { min: number; max: number }
}

export function computeTournamentWorkloadSummary(input: {
  qualificationTrackId: string
  matchTrackIds: readonly (string | null | undefined)[]
  groups: readonly { memberUserIds: readonly string[] }[]
  groupsCount: number
  advancementCount: number
  eliminationType: EliminationType
}): TournamentWorkloadSummary {
  const trackSet = new Set<string>()
  if (input.qualificationTrackId) {
    trackSet.add(input.qualificationTrackId)
  }
  for (const tid of input.matchTrackIds) {
    if (tid) trackSet.add(tid)
  }

  const sizes = input.groups.map(g => g.memberUserIds.length)
  const gMin = sizes.length > 0 ? Math.min(...sizes) : 0
  const gMax = sizes.length > 0 ? Math.max(...sizes) : 0
  const groupMatchesMin = Math.max(0, gMin - 1)
  const groupMatchesMax = Math.max(0, gMax - 1)

  const adv = input.groupsCount * input.advancementCount
  const upperDepth = adv >= 2 ? Math.log2(adv) : 0

  const maxBracketPerPlayer =
    input.eliminationType === 'single' ? upperDepth : 2 * upperDepth + 1

  return {
    distinctTrackCount: trackSet.size,
    qualificationLapsPerPlayer: { min: 1, max: 1 },
    tournamentMatchesPerPlayer: {
      min: groupMatchesMin,
      max: groupMatchesMax + maxBracketPerPlayer,
    },
  }
}
