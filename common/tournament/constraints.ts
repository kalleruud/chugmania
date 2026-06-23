import type { EliminationType } from '../../backend/database/schema'

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0
}

export function validGroupsCounts(participantCount: number): number[] {
  const out: number[] = []
  for (let g = 1; g <= participantCount; g++) {
    out.push(g)
  }
  return out
}

export function validAdvancementCounts(
  participantCount: number,
  groupsCount: number
): number[] {
  const maxA = Math.floor(participantCount / groupsCount)
  const out: number[] = []
  for (let a = 1; a <= maxA; a++) {
    out.push(a)
  }
  return out
}

export function combinationValid(
  participantCount: number,
  groupsCount: number,
  advancementCount: number,
  eliminationType: EliminationType
): boolean {
  if (participantCount < 4) return false
  if (groupsCount < 1 || groupsCount > participantCount) return false
  const maxA = Math.floor(participantCount / groupsCount)
  if (advancementCount < 1 || advancementCount > maxA) return false
  const total = groupsCount * advancementCount
  if (total < 2 || !isPowerOfTwo(total)) return false
  if (eliminationType === 'double' && total !== 4 && total !== 8) return false
  return true
}

export function doubleEliminationReachable(participantCount: number): boolean {
  for (const g of validGroupsCounts(participantCount)) {
    for (const a of validAdvancementCounts(participantCount, g)) {
      if (combinationValid(participantCount, g, a, 'double')) return true
    }
  }
  return false
}

export function snapToValidCombination(input: {
  participantCount: number
  groupsCount: number
  advancementCount: number
  eliminationType: EliminationType
}): { groupsCount: number; advancementCount: number } {
  let { groupsCount, advancementCount, eliminationType, participantCount } =
    input
  if (participantCount < 4) {
    return { groupsCount: 1, advancementCount: 1 }
  }
  groupsCount = Math.min(Math.max(1, groupsCount), participantCount)
  advancementCount = Math.min(
    Math.max(1, advancementCount),
    Math.floor(participantCount / groupsCount)
  )
  let tries = 0
  while (
    tries < 2000 &&
    !combinationValid(
      participantCount,
      groupsCount,
      advancementCount,
      eliminationType
    )
  ) {
    tries++
    if (advancementCount > 1) {
      advancementCount--
      continue
    }
    if (groupsCount > 1) {
      groupsCount--
      advancementCount = Math.floor(participantCount / groupsCount)
      advancementCount = Math.max(1, advancementCount)
      continue
    }
    break
  }
  if (
    !combinationValid(
      participantCount,
      groupsCount,
      advancementCount,
      eliminationType
    )
  ) {
    groupsCount = 1
    let a = Math.floor(participantCount / groupsCount)
    while (a >= 1 && !isPowerOfTwo(groupsCount * a)) {
      a--
    }
    advancementCount = Math.max(1, a)
  }
  return { groupsCount, advancementCount }
}
