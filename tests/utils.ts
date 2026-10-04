import SessionManager from '@backend/src/managers/session.manager'
import UserManager from '@backend/src/managers/user.manager'
import type { SessionWithSignups } from '@common/models/session'
import type { ErrorResponse, SuccessResponse } from '@common/models/socket.io'
import type { Track } from '@common/models/track'
import type { User } from '@common/models/user'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { tracks, users, type SessionResponse } from '../backend/database/schema'
import AuthManager from '../backend/src/managers/auth.manager'
import type { TypedSocket } from '../backend/src/server'
import { db } from './setup'

const PASSWORD = 'test-password'

export function createUser(
  name: string,
  role: User['role'] = 'user',
  id?: string
): User {
  return db
    .insert(users)
    .values({
      id,
      email: `${name}@example.test`,
      firstName: name,
      role,
      passwordHash: createHash('sha512').update(PASSWORD).digest(),
    })
    .returning()
    .get()
}

export async function login(user: Pick<User, 'email'>): Promise<TypedSocket> {
  const auth: Record<string, unknown> = { token: process.env.SECRET }
  const socket = { id: 'test-client', handshake: { auth } } as TypedSocket
  const response = await AuthManager.onLogin(socket, {
    type: 'LoginRequest',
    email: user.email,
    password: PASSWORD,
  })
  assert(response.success)
  socket.handshake.auth.token = response.token
  return socket
}

export function createTracks(count = 1): Track[] {
  return db
    .insert(tracks)
    .values(
      Array.from(
        { length: count },
        (_, i) =>
          ({
            number: i + 1,
            level: 'white',
            type: 'stadium',
          }) satisfies typeof tracks.$inferInsert
      )
    )
    .returning()
    .all()
}

export async function createSession(
  s: TypedSocket,
  rsvpList: { user: string; response: SessionResponse }[]
): Promise<SessionWithSignups> {
  const sessionId = Bun.randomUUIDv7()

  await SessionManager.onCreateSession(s, {
    type: 'CreateSessionRequest',
    id: sessionId,
    name: 'Test Cup',
    date: new Date(0),
  }).then(assertResponse)

  await Promise.all(
    rsvpList.map(rsvp =>
      SessionManager.onRsvpSession(s, {
        type: 'RsvpSessionRequest',
        session: sessionId,
        ...rsvp,
      }).then(assertResponse)
    )
  )

  const session = await SessionManager.getSession(sessionId)
  assert(session !== null, 'Could not fetch session')
  return session
}

export async function createRsvps(
  counts: Record<SessionResponse, number>
): Promise<Parameters<typeof createSession>[1]> {
  const users = await UserManager.getAllUsers()
  const responses: SessionResponse[] = ['yes', 'no', 'maybe']
  let index = 0

  return responses.flatMap(response =>
    Array.from({ length: counts[response] }, () => {
      const user = users[index++]
      assert(user, 'Not enough users to create the requested RSVPs')
      return { user: user.id, response }
    })
  )
}

export function assertResponse(
  r: SuccessResponse | ErrorResponse
): asserts r is SuccessResponse {
  assert(r.success, r.success ? 'CRITICAL ERROR' : r.message)
}
