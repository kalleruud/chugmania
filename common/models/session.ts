import { sessionSignups, sessions } from '../../backend/database/schema'
import type { UserInfo } from './user'

export type Session = typeof sessions.$inferSelect
export type CreateSession = typeof sessions.$inferInsert

export type SessionSignup = typeof sessionSignups.$inferSelect

export type SessionWithSignups = Session & {
  signups: {
    user: UserInfo
    joinedAt: SessionSignup['createdAt']
    response: SessionSignup['response']
  }[]
}
