import type { SessionResponse } from '@backend/database/schema'
import type { SessionSignup } from '@common/models/session'
import type { Match } from '../models/match'
import type { TimeEntry } from '../models/timeEntry'

type AccumulatedSignup = {
  user: string
  response: SessionResponse
}

const YES_RES: SessionResponse = 'yes'

export default function accumulateSignups(
  session: { id: string; signups: SessionSignup[] },
  te: TimeEntry[],
  ma: Match[]
): AccumulatedSignup[] {
  const accumulatedSignups = new Set([
    ...te.filter(te => te.session === session.id).map(te => te.user),
    ...ma.filter(m => m.session === session.id && m.user1).map(m => m.user1!),
    ...ma.filter(m => m.session === session.id && m.user2).map(m => m.user2!),
  ])

  const existingSignups = session.signups
    .filter(s => !accumulatedSignups.has(s.user.id))
    .map(s => ({ user: s.user.id, response: s.response }))

  return [
    ...existingSignups,
    ...Array.from(accumulatedSignups).map(user => ({
      user,
      response: YES_RES,
    })),
  ]
}
