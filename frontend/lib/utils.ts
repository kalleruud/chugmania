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
  locale: Locale = 'no'
) {
  if (bracket === 'grand_final') {
    return loc[locale].tournament.roundNames.grand_final
  }

  if (bracket === 'group') {
    return `${loc[locale].tournament.roundNames.upper.round} ${round}`
  }

  if (bracket === 'lower') {
    return `${loc[locale].tournament.roundNames.lower.round} ${round}`
  }

  const index = round - 1
  return (
    Object.values(loc[locale].tournament.roundNames.upper).at(index) ??
    loc[locale].tournament.roundNames.upper.round
  )
}
