import type { Session } from '@common/models/session'
import type { Track } from '@common/models/track'
import type { User } from '@common/models/user'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  sessions,
  sessionSignups,
  tracks,
  users,
} from '../backend/database/schema'
import AuthManager from '../backend/src/managers/auth.manager'
import type { TypedSocket } from '../backend/src/server'
import { db } from './setup'

const PASSWORD = 'test-password'

export function createUser(name: string, role: User['role'] = 'user'): User {
  return db
    .insert(users)
    .values({
      email: `${name}@example.test`,
      firstName: name,
      role,
      passwordHash: createHash('sha512').update(PASSWORD).digest(),
    })
    .returning()
    .get()
}

export async function login(user: Pick<User, 'email'>): Promise<TypedSocket> {
  const auth: Record<string, unknown> = { token: '' }
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

export function createTrack(): Track {
  return db
    .insert(tracks)
    .values({ number: 1, level: 'white', type: 'stadium' })
    .returning()
    .get()
}

export function createSession(): Session {
  return db
    .insert(sessions)
    .values({ name: 'Test Cup', date: new Date(0) })
    .returning()
    .get()
}

export function createSessionSignup(session: Session, user: User): void {
  db.insert(sessionSignups)
    .values({ session: session.id, user: user.id, response: 'yes' })
    .run()
}
