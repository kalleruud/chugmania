import type { Ranking } from '@common/models/ranking'
import type { TournamentPreview } from '@common/models/tournament'
import type { UserInfo } from '@common/models/user'
import type { EliminationType } from 'backend/database/schema'

export function generateTournamentPreview(
  players: UserInfo[],
  rankings: Ranking[],
  groupsCount: number,
  advancementCount: number,
  eliminationType: EliminationType
): TournamentPreview {
  const ratingMap = new Map(rankings.map(r => [r.user, r.totalRating]))

  const sortedPlayers = [...players].sort((a, b) => {
    const ratingA = ratingMap.get(a.id) ?? 0
    const ratingB = ratingMap.get(b.id) ?? 0
    return ratingB - ratingA
  })

  const groupNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const groups: TournamentPreview['groups'] = []

  for (let i = 0; i < groupsCount; i++) {
    groups.push({
      name: `Gruppe ${groupNames[i]}`,
      players: [],
    })
  }

  for (let i = 0; i < sortedPlayers.length; i++) {
    const row = Math.floor(i / groupsCount)
    const positionInRow = i % groupsCount
    const isReverseRow = row % 2 === 1

    const groupIndex = isReverseRow
      ? groupsCount - 1 - positionInRow
      : positionInRow

    const player = sortedPlayers[i]
    groups[groupIndex].players.push({
      id: player.id,
      name: player.shortName ?? player.firstName ?? 'Unknown',
      rating: ratingMap.get(player.id) ?? 0,
      seed: row + 1,
    })
  }

  let groupMatchCount = 0
  for (const group of groups) {
    const n = group.players.length
    groupMatchCount += (n * (n - 1)) / 2
  }

  const totalAdvancing = groupsCount * advancementCount
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(totalAdvancing)))

  const bracketStages: TournamentPreview['bracketStages'] = []
  let roundNum = bracketSize
  let bracketMatchCount = 0

  while (roundNum >= 2) {
    const matchesInRound = roundNum / 2
    const stageName = getRoundName(roundNum, false)

    bracketStages.push({
      stage: stageName,
      matchCount: matchesInRound,
    })
    bracketMatchCount += matchesInRound

    roundNum = roundNum / 2
  }

  if (eliminationType === 'double') {
    let lowerMatchCount = 0

    let prevLowerCount = Math.floor(bracketSize / 4)
    let upperRoundNum = bracketSize / 2

    while (upperRoundNum >= 2) {
      const dropInCount = Math.min(prevLowerCount, upperRoundNum / 2)
      lowerMatchCount += dropInCount

      if (dropInCount > 1) {
        const survivorCount = Math.floor(dropInCount / 2)
        lowerMatchCount += survivorCount
        prevLowerCount = survivorCount
      } else {
        prevLowerCount = dropInCount
      }

      upperRoundNum = upperRoundNum / 2
    }

    lowerMatchCount += 1

    bracketStages.push({
      stage: 'Lower Bracket',
      matchCount: lowerMatchCount,
    })

    bracketStages.push({
      stage: 'Grand Finale',
      matchCount: 1,
    })

    bracketMatchCount += lowerMatchCount + 1
  }

  return {
    groups,
    bracketStages,
    groupMatchCount,
    bracketMatchCount,
    totalMatchCount: groupMatchCount + bracketMatchCount,
  }
}

export function getRoundName(size: number, isLower: boolean): string {
  const prefix = isLower ? 'Taper ' : ''
  if (size === 2) return `${prefix}Finale`
  if (size === 4) return `${prefix}Semifinale`
  if (size === 8) return `${prefix}Kvartfinale`
  if (size === 16) return `${prefix}Åttendelsfinale`
  return `${prefix}Runde ${size}`
}

export function getBracketStagesForTrackSelection(
  groupsCount: number,
  advancementCount: number,
  eliminationType: EliminationType
): string[] {
  const totalAdvancing = groupsCount * advancementCount
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(totalAdvancing)))

  const stages: string[] = []
  let roundNum = bracketSize

  while (roundNum >= 2) {
    stages.push(getRoundName(roundNum, false))
    roundNum = roundNum / 2
  }

  if (eliminationType === 'double') {
    stages.push('Lower Bracket')
    stages.push('Grand Finale')
  }

  return stages
}

export function distributeTracksBalanced(
  matchCount: number,
  trackIds: string[]
): string[] {
  if (trackIds.length === 0) return []
  if (trackIds.length === 1) return Array(matchCount).fill(trackIds[0])

  const result: string[] = []
  const trackUsage = new Map<string, number>()

  for (const trackId of trackIds) {
    trackUsage.set(trackId, 0)
  }

  for (let i = 0; i < matchCount; i++) {
    let minUsage = Infinity
    let selectedTrack = trackIds[0]

    for (const trackId of trackIds) {
      const usage = trackUsage.get(trackId) ?? 0
      if (usage < minUsage) {
        minUsage = usage
        selectedTrack = trackId
      }
    }

    result.push(selectedTrack)
    trackUsage.set(selectedTrack, (trackUsage.get(selectedTrack) ?? 0) + 1)
  }

  return result
}
