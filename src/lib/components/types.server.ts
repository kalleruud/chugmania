import { type Group as G } from '@/server/managers/group.manager'
import { type Match as M } from '@/server/managers/match.manager'
import { type Session as S } from '@/server/managers/session.manager'
import { type TimeEntry as TE } from '@/server/managers/timeEntry.manager'
import { type BracketRound as BR } from '@/server/managers/tournament.manager'
import { type Track as T } from '@/server/managers/track.manager'
import { type PublicUser as U } from '@/server/managers/user.manager'

export type LookupEntity = {
  id: string
  featured: boolean
  label: string
  type?: string
  date?: Date
}

export type Session = S
export type TimeEntry = TE
export type Track = T
export type PublicUser = U
export type Match = M
export type Group = G
export type BracketRound = BR

export type FormMode = 'login' | 'register'
export type ResponseMessage = { success: boolean; message?: string }

interface EnumObject {
  [enumValue: number]: string
}

export function getEnumValues(e: EnumObject): string[] {
  // @ts-expect-error
  return Object.keys(e).map(i => e[i])
}
