import type {
  CaptureAssignment,
  CaptureHeatPayload,
} from '@common/models/capture'

export function isHeatPayload(data: any): data is CaptureHeatPayload {
  if (typeof data !== 'object' || data === null) return false
  if (typeof data.heatId !== 'string' || data.heatId.length === 0) return false
  if (typeof data.mapUid !== 'string' || data.mapUid.length === 0) return false
  if (typeof data.mapName !== 'string') return false
  if (typeof data.playerCount !== 'number') return false
  if (!Array.isArray(data.results) || data.results.length === 0) return false
  return data.results.every(
    (r: any) =>
      typeof r === 'object' &&
      r !== null &&
      typeof r.slot === 'number' &&
      typeof r.bestTimeMs === 'number' &&
      r.bestTimeMs > 0
  )
}

export function templateFor(playerCount: number): 'solo' | 'duel' | null {
  if (playerCount === 1) return 'solo'
  if (playerCount === 2) return 'duel'
  return null
}

export function winningSlot(
  laps: { slot: number; duration: number }[]
): number | null {
  if (laps.length < 2) return laps[0]?.slot ?? null
  const sorted = [...laps].sort((a, b) => a.duration - b.duration)
  if (sorted[0].duration === sorted[1].duration) return null
  return sorted[0].slot
}

export function validateAssignments(
  slots: number[],
  assignments: CaptureAssignment[]
): string | null {
  for (const slot of slots) {
    const found = assignments.find(a => a.slot === slot)
    if (!found || typeof found.user !== 'string' || found.user.length === 0) {
      return `Mangler spiller for plass ${slot}`
    }
  }
  const users = assignments.map(a => a.user)
  if (new Set(users).size !== users.length) {
    return 'Samme spiller kan ikke stå på begge plassene'
  }
  return null
}
