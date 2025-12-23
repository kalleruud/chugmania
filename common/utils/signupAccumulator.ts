import type { SessionResponse } from '../../backend/database/schema'
import type { Match } from '../models/match'
import type { SessionSignup } from '../models/session'
import type { TimeEntry } from '../models/timeEntry'

type AccumulatedSignup = {
  user: string
  response: SessionResponse
}

const YES_RES: SessionResponse = 'yes'

export default function accumulateSignups(
  sessionId: string,
  sessionSignups: SessionSignup[],
  te: TimeEntry[],
  ma: Match[]
): AccumulatedSignup[] {
  const alreadySignedUp = new Set(
    sessionSignups.filter(s => s.response === YES_RES).map(s => s.user.id)
  )
  const timeEntryUsers = te
    .filter(te => te.session === sessionId && !alreadySignedUp.has(te.user))
    .map(te => te.user)
  const matches = ma.filter(m => m.session === sessionId)
  const user1Matches = matches
    .filter(m => m.user1 !== null && !alreadySignedUp.has(m.user1))
    .map(m => m.user1!)
  const user2Matches = matches
    .filter(m => m.user2 !== null && !alreadySignedUp.has(m.user2))
    .map(m => m.user2!)
  const users = new Set([...user1Matches, ...user2Matches, ...timeEntryUsers])

  return [
    ...sessionSignups.map(s => ({ user: s.user.id, response: s.response })),
    ...Array.from(users).map(user => ({ user, response: YES_RES })),
  ]
}
