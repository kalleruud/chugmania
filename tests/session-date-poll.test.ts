import { describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import type { SessionResponse } from '../backend/database/schema'
import SessionManager from '../backend/src/managers/session.manager'
import { broadcast, type TypedSocket } from '../backend/src/server'
import { assertResponse, createUser, login } from './utils'

const MONDAY = Date.UTC(2030, 0, 7, 17)
const TUESDAY = Date.UTC(2030, 0, 8, 17)
const FRIDAY = Date.UTC(2030, 0, 11, 17)

describe('Session date poll', () => {
  const sessionId = Bun.randomUUIDv7()
  const owner = createUser('poll-owner', 'moderator')
  const alice = createUser('poll-alice')
  const bob = createUser('poll-bob')
  const carol = createUser('poll-carol')
  let ownerSocket: TypedSocket
  let aliceSocket: TypedSocket
  let bobSocket: TypedSocket

  async function fetchSession() {
    const session = await SessionManager.getSession(sessionId)
    assert(session, 'Could not fetch session')
    return session
  }

  function vote(socket: TypedSocket, dates: number[]) {
    return SessionManager.onVoteSessionDate(socket, {
      type: 'VoteSessionDateRequest',
      session: sessionId,
      dates,
    })
  }

  function rsvp(user: string, response: SessionResponse) {
    return SessionManager.onRsvpSession(ownerSocket, {
      type: 'RsvpSessionRequest',
      session: sessionId,
      user,
      response,
    }).then(assertResponse)
  }

  function votersFor(
    session: Awaited<ReturnType<typeof fetchSession>>,
    date: number
  ) {
    return session.dateVotes
      .filter(v => v.dates.includes(date))
      .map(v => v.user.firstName)
      .toSorted()
  }

  test.serial('owner defines the selectable dates', async () => {
    ownerSocket = await login(owner)
    aliceSocket = await login(alice)
    bobSocket = await login(bob)

    await SessionManager.onCreateSession(ownerSocket, {
      type: 'CreateSessionRequest',
      id: sessionId,
      name: 'Poll Cup',
      date: new Date(MONDAY),
    }).then(assertResponse)

    await assert.rejects(vote(aliceSocket, [MONDAY]))

    await SessionManager.onEditSession(ownerSocket, {
      type: 'EditSessionRequest',
      id: sessionId,
      dateOptions: [MONDAY, TUESDAY, FRIDAY],
    }).then(assertResponse)

    const session = await fetchSession()
    expect(session.dateOptions).toEqual([MONDAY, TUESDAY, FRIDAY])
    expect(session.dateVotingClosed).toBe(false)
    expect(session.dateVotes).toEqual([])
  })

  test.serial('players cannot change the poll', async () => {
    await assert.rejects(
      SessionManager.onEditSession(aliceSocket, {
        type: 'EditSessionRequest',
        id: sessionId,
        dateOptions: [FRIDAY],
      })
    )
    await assert.rejects(
      SessionManager.onEditSession(aliceSocket, {
        type: 'EditSessionRequest',
        id: sessionId,
        dateVotingClosed: true,
      })
    )
  })

  test.serial('players submit and edit their responses', async () => {
    await vote(aliceSocket, [MONDAY, TUESDAY]).then(assertResponse)
    await vote(bobSocket, [MONDAY]).then(assertResponse)
    await vote(aliceSocket, [TUESDAY, FRIDAY]).then(assertResponse)

    const session = await fetchSession()
    expect(session.dateVotes).toHaveLength(2)
    expect(votersFor(session, MONDAY)).toEqual(['poll-bob'])
    expect(votersFor(session, TUESDAY)).toEqual(['poll-alice'])
    expect(votersFor(session, FRIDAY)).toEqual(['poll-alice'])

    expect(broadcast).toHaveBeenCalledWith(
      'all_sessions',
      expect.arrayContaining([
        expect.objectContaining({
          id: sessionId,
          dateVotes: session.dateVotes,
        }),
      ])
    )
  })

  test.serial('rejects dates that are not options', async () => {
    await assert.rejects(vote(bobSocket, [MONDAY + 1]))
    expect(votersFor(await fetchSession(), MONDAY)).toEqual(['poll-bob'])
  })

  test.serial('owner closes submissions and picks a date', async () => {
    await rsvp(bob.id, 'yes')
    await rsvp(carol.id, 'maybe')

    await SessionManager.onEditSession(ownerSocket, {
      type: 'EditSessionRequest',
      id: sessionId,
      date: new Date(TUESDAY),
      dateVotingClosed: true,
    }).then(assertResponse)

    await assert.rejects(vote(bobSocket, [TUESDAY]))

    const session = await fetchSession()
    expect(session.dateVotingClosed).toBe(true)
    expect(session.date.getTime()).toBe(TUESDAY)
    expect(votersFor(session, TUESDAY)).toEqual(['poll-alice'])

    const responses = Object.fromEntries(
      session.signups.map(s => [s.user.firstName, s.response])
    )
    expect(responses).toEqual({
      'poll-alice': 'yes',
      'poll-bob': 'no',
      'poll-carol': 'maybe',
    })
  })
})
