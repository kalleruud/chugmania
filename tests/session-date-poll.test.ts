import { describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import db from '../backend/database/database'
import {
  sessionSignups,
  type SessionResponse,
} from '../backend/database/schema'
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

  function rsvp(user: string, response: SessionResponse, session = sessionId) {
    return SessionManager.onRsvpSession(ownerSocket, {
      type: 'RsvpSessionRequest',
      session,
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

  function openPoll(socket: TypedSocket, dateOptions: number[]) {
    return SessionManager.onEditSession(socket, {
      type: 'EditSessionRequest',
      id: sessionId,
      date: null,
      dateOptions,
      dateVotingClosed: false,
    })
  }

  function responses(session: Awaited<ReturnType<typeof fetchSession>>) {
    return Object.fromEntries(
      session.signups.map(s => [s.user.firstName, s.response])
    )
  }

  test.serial('owner opens a poll on a tentative session', async () => {
    ownerSocket = await login(owner)
    aliceSocket = await login(alice)
    bobSocket = await login(bob)

    await SessionManager.onCreateSession(ownerSocket, {
      type: 'CreateSessionRequest',
      id: sessionId,
      name: 'Poll Cup',
      date: new Date(MONDAY),
    }).then(assertResponse)
    await rsvp(bob.id, 'yes')
    await rsvp(carol.id, 'maybe')

    await assert.rejects(vote(aliceSocket, [MONDAY]))
    await assert.rejects(openPoll(ownerSocket, [MONDAY, TUESDAY, FRIDAY]))

    await SessionManager.onEditSession(ownerSocket, {
      type: 'EditSessionRequest',
      id: sessionId,
      status: 'tentative',
    }).then(assertResponse)
    await openPoll(ownerSocket, [MONDAY, TUESDAY, FRIDAY]).then(assertResponse)

    const session = await fetchSession()
    expect(session.date).toBeNull()
    expect(session.dateOptions).toEqual([MONDAY, TUESDAY, FRIDAY])
    expect(session.dateVotingClosed).toBe(false)
    expect(session.dateVotes).toEqual([])
    expect(responses(session)).toEqual({
      'poll-bob': 'maybe',
      'poll-carol': 'maybe',
    })
  })

  test.serial('players cannot sign up while the poll is open', async () => {
    await assert.rejects(rsvp(alice.id, 'yes'))
    expect(responses(await fetchSession())).not.toHaveProperty('poll-alice')
  })

  test.serial('players cannot change the poll', async () => {
    await assert.rejects(openPoll(aliceSocket, [FRIDAY]))
    await assert.rejects(
      SessionManager.onEditSession(aliceSocket, {
        type: 'EditSessionRequest',
        id: sessionId,
        date: new Date(FRIDAY),
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
    expect(responses(session)).toEqual({
      'poll-alice': 'maybe',
      'poll-bob': 'maybe',
      'poll-carol': 'maybe',
    })

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

  test.serial('a session without a date stays tentative', async () => {
    await assert.rejects(
      SessionManager.onEditSession(ownerSocket, {
        type: 'EditSessionRequest',
        id: sessionId,
        status: 'confirmed',
      })
    )
    const session = await fetchSession()
    expect(session.status).toBe('tentative')
    expect(session.date).toBeNull()
  })

  test.serial('owner picks a date and closes the poll', async () => {
    await SessionManager.onEditSession(ownerSocket, {
      type: 'EditSessionRequest',
      id: sessionId,
      date: new Date(TUESDAY),
      status: 'confirmed',
    }).then(assertResponse)

    await assert.rejects(vote(bobSocket, [TUESDAY]))

    const session = await fetchSession()
    expect(session.dateVotingClosed).toBe(true)
    expect(session.status).toBe('confirmed')
    expect(session.date?.getTime()).toBe(TUESDAY)

    expect(responses(session)).toEqual({
      'poll-alice': 'yes',
      'poll-bob': 'no',
      'poll-carol': 'maybe',
    })

    await rsvp(carol.id, 'yes')
    expect(responses(await fetchSession())['poll-carol']).toBe('yes')
  })

  test.serial('reopening the poll keeps the votes', async () => {
    await SessionManager.onEditSession(ownerSocket, {
      type: 'EditSessionRequest',
      id: sessionId,
      status: 'tentative',
    }).then(assertResponse)
    await openPoll(ownerSocket, [MONDAY, TUESDAY, FRIDAY]).then(assertResponse)

    const session = await fetchSession()
    expect(session.date).toBeNull()
    expect(votersFor(session, MONDAY)).toEqual(['poll-bob'])
    expect(votersFor(session, FRIDAY)).toEqual(['poll-alice'])
    expect(responses(session)).toEqual({
      'poll-alice': 'maybe',
      'poll-bob': 'maybe',
      'poll-carol': 'maybe',
    })
  })

  test.serial('clearing the date makes the session tentative', async () => {
    const id = Bun.randomUUIDv7()
    await SessionManager.onCreateSession(ownerSocket, {
      type: 'CreateSessionRequest',
      id,
      name: 'Undated Cup',
      date: new Date(MONDAY),
    }).then(assertResponse)
    await rsvp(bob.id, 'yes', id)

    await assert.rejects(
      SessionManager.onEditSession(ownerSocket, {
        type: 'EditSessionRequest',
        id,
        date: null,
      })
    )
    await SessionManager.onEditSession(ownerSocket, {
      type: 'EditSessionRequest',
      id,
      date: null,
      status: 'tentative',
    }).then(assertResponse)

    const session = await SessionManager.getSession(id)
    assert(session)
    expect(session.date).toBeNull()
    expect(session.status).toBe('tentative')
    expect(responses(session)).toEqual({ 'poll-bob': 'yes' })
    await rsvp(alice.id, 'maybe', id)
  })
})

describe('Removing session signups', () => {
  const sessionId = Bun.randomUUIDv7()
  const duplicateId = Bun.randomUUIDv7()
  const moderator = createUser('remove-mod', 'moderator')
  const dave = createUser('remove-dave')

  function removeSignup(socket: TypedSocket, id: string) {
    return SessionManager.onDeleteSessionSignup(socket, {
      type: 'DeleteSessionSignupRequest',
      id,
    })
  }

  test.serial(
    'moderators remove a single signup row after the poll',
    async () => {
      const moderatorSocket = await login(moderator)
      const daveSocket = await login(dave)
      await SessionManager.onCreateSession(moderatorSocket, {
        type: 'CreateSessionRequest',
        id: sessionId,
        name: 'Remove Cup',
        date: new Date(MONDAY),
      }).then(assertResponse)
      await SessionManager.onEditSession(moderatorSocket, {
        type: 'EditSessionRequest',
        id: sessionId,
        date: null,
        status: 'tentative',
        dateOptions: [MONDAY, TUESDAY],
        dateVotingClosed: false,
      }).then(assertResponse)
      await SessionManager.onVoteSessionDate(daveSocket, {
        type: 'VoteSessionDateRequest',
        session: sessionId,
        dates: [MONDAY],
      }).then(assertResponse)
      db.insert(sessionSignups)
        .values({
          id: duplicateId,
          session: sessionId,
          user: dave.id,
          response: 'no',
        })
        .run()

      await assert.rejects(removeSignup(moderatorSocket, duplicateId))
      await SessionManager.onEditSession(moderatorSocket, {
        type: 'EditSessionRequest',
        id: sessionId,
        date: new Date(MONDAY),
        status: 'confirmed',
        dateVotingClosed: true,
      }).then(assertResponse)

      await assert.rejects(removeSignup(daveSocket, duplicateId))
      await removeSignup(moderatorSocket, duplicateId).then(assertResponse)
      await assert.rejects(removeSignup(moderatorSocket, duplicateId))

      const session = await SessionManager.getSession(sessionId)
      assert(session)
      expect(session.signups.map(s => s.user.id)).toEqual([dave.id])
      expect(session.dateVotes.map(v => v.user.id)).toEqual([dave.id])
    }
  )

  test.serial('changing a response updates the active row', async () => {
    const moderatorSocket = await login(moderator)
    const before = await SessionManager.getSession(sessionId)
    assert(before?.signups[0])
    await removeSignup(moderatorSocket, before.signups[0].id).then(
      assertResponse
    )
    db.insert(sessionSignups)
      .values({ session: sessionId, user: dave.id, response: 'no' })
      .run()

    await SessionManager.onRsvpSession(moderatorSocket, {
      type: 'RsvpSessionRequest',
      session: sessionId,
      user: dave.id,
      response: 'yes',
    }).then(assertResponse)

    const session = await SessionManager.getSession(sessionId)
    assert(session)
    expect(session.signups.map(s => s.response)).toEqual(['yes'])
  })
})
