import type { StageLevel, TournamentBracket } from '@backend/database/schema'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import loc, { type Locale } from './locales'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStageName(
  name: StageLevel | null,
  bracket: TournamentBracket | null,
  lowerBracketIndex: number,
  locale: Locale = 'no'
): string {
  // If it has a specific stage level, return its name
  if (name) return loc[locale].match.stageNames[name]

  // For lower bracket stages, use the local round number starting from 1
  if (bracket === 'lower') {
    return `${loc[locale].tournament.roundNames.lower.round} ${lowerBracketIndex + 1}`
  }

  // Default: generic round numbering (for group stage)
  return `${loc[locale].match.round} ${lowerBracketIndex + 1}`
}
