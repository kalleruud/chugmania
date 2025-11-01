import { sessionSignups, sessions } from '../../backend/database/schema'
import type { TimeEntry } from './timeEntry'
import type { Track } from './track'
import { type UserInfo } from './user'

export type Session = typeof sessions.$inferSelect
export type CreateSession = typeof sessions.$inferInsert

export type SessionSignup = Omit<typeof sessionSignups.$inferSelect, 'user'> & {
  user: UserInfo
}

export type SessionLapTime = {
  entry: TimeEntry
  track: Track
  user: UserInfo
}

export type SessionWithSignups = Session & {
  signups: SessionSignup[]
  lapTimes: SessionLapTime[]
}
