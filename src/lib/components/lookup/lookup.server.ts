import { type Track as T } from '@/server/managers/track.manager'
import { type PublicUser as U } from '@/server/managers/user.manager'
import { type Session as S } from '@/server/managers/session.manager'

export type LookupEntity = { id: string; label: string; type?: string; date?: Date }

export type Track = T
export type PublicUser = U
export type Session = S
