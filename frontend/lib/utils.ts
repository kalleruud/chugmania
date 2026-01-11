import type { TournamentBracket } from '@backend/database/schema'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import loc, { type Locale } from './locales'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRoundName(
  round: number,
  bracket: TournamentBracket,
  isDoubleElimination: boolean,
  groupNumber?: number,
  locale: Locale = 'no'
) {
  if (bracket === 'grand_final') {
    return loc[locale].tournament.roundNames.grand_final
  }

  if (bracket === 'group' && groupNumber) {
    return loc[locale].tournament.groupMatchName(groupNumber, round)
  }

  const offset = isDoubleElimination ? 1 : 0
  const index = round - 1 + offset

  if (bracket === 'upper') {
    return (
      Object.values(loc[locale].tournament.roundNames.upper).at(index) ??
      loc[locale].tournament.roundNames.upper.round
    )
  }

  return (
    Object.values(loc[locale].tournament.roundNames.lower).at(index + 1) ??
    loc[locale].tournament.roundNames.lower.round
  )
}
