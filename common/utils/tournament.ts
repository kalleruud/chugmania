import type { MatchStage } from '../../backend/database/schema'
import loc from '../locale/locales'
import type { Match } from '../models/match'
import type { EliminationType, TournamentConfig } from '../models/tournament'

export function validConfiguration(
  count: number,
  groups: number,
  advancement: number,
  type: EliminationType
): boolean {
  if (type === 'round_robin')
    return count >= 2 && groups === 1 && advancement === 0
  const advancers = groups * advancement
  return (
    count >= 4 &&
    Number.isInteger(groups) &&
    groups >= 1 &&
    groups <= count &&
    Number.isInteger(advancement) &&
    advancement >= 1 &&
    advancement <= Math.floor(count / groups) &&
    advancers >= 2 &&
    Number.isInteger(Math.log2(advancers)) &&
    (type === 'single' || advancers === 4 || advancers === 8)
  )
}
export function configurationOptions(count: number, type: EliminationType) {
  if (type === 'round_robin')
    return count >= 2 ? [{ groups: 1, advancement: 0 }] : []
  const options: { groups: number; advancement: number }[] = []
  for (let groups = 1; groups <= count; groups++) {
    for (
      let advancement = 1;
      advancement <= Math.floor(count / groups);
      advancement++
    ) {
      if (validConfiguration(count, groups, advancement, type))
        options.push({ groups, advancement })
    }
  }
  return options
}
export function upperStage(size: number): MatchStage {
  if (size === 2) return 'final'
  if (size === 4) return 'semi'
  if (size === 8) return 'quarter'
  if (size === 16) return 'eight'
  return `round_${size}`
}
export function stageName(stage: MatchStage | null): string {
  if (!stage) return ''
  if (stage.startsWith('round_')) return `${stage.slice(6)}-delsrunde`
  return loc.no.match.stage[stage]
}
export function firstPendingMatch(matches: Match[]): Match | undefined {
  return matches.find(
    match =>
      match.status === 'planned' &&
      match.tournament?.reset !== 'conditional' &&
      match.tournament?.reset !== 'unneeded'
  )
}
export function usedStages(
  config: TournamentConfig,
  count: number
): MatchStage[] {
  if (config.eliminationType === 'round_robin') return ['group']
  const stages: MatchStage[] = []
  if (count > config.groupsCount) stages.push('group')
  const advancers = config.groupsCount * config.advancementCount
  for (let size = advancers; size >= 2; size /= 2) stages.push(upperStage(size))
  if (config.eliminationType === 'double') {
    if (advancers === 8) stages.push('loser_quarter')
    stages.push('loser_semi', 'loser_final', 'grand_final', 'grand_final_reset')
  }
  return stages
}
