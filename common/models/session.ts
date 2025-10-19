import { sessionSignups, sessions } from '../../backend/database/schema'
import { type UserInfo } from './user'

export type Session = typeof sessions.$inferSelect
export type CreateSession = typeof sessions.$inferInsert

export type SessionSignup = Omit<typeof sessionSignups.$inferSelect, 'user'> & {
  user: UserInfo
}

export type SessionWithSignups = Session & {
  signups: SessionSignup[]
}
