import type { StageLevel } from '@backend/database/schema'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import loc, { type Locale } from './locales'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStageName(
  name: StageLevel | null,
  stageIndex: number,
  locale: Locale = 'no'
): string {
  if (name) return loc[locale].match.stageNames[name]
  return `${loc[locale].match.round} ${stageIndex + 1}`
}
