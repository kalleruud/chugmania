import loc from '@/lib/locales'
import type { StageLevel, TournamentBracket } from '@backend/database/schema'

export function getStageName(
  level: StageLevel | null,
  bracket: TournamentBracket | null,
  index: number
): string {
  // For group stages, always use round numbering
  if (level === 'group') {
    return `${loc.no.match.round} ${index + 1}`
  }

  // If it has a specific stage level, return its name
  if (level) return loc.no.match.stageNames[level]

  // For lower bracket stages, use the local round number starting from 1
  if (bracket === 'lower') {
    return `${loc.no.tournament.roundNames.lower.round} ${index + 1}`
  }

  // Default: generic round numbering
  return `${loc.no.match.round} ${index + 1}`
}
