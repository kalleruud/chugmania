import db, { database } from '@backend/database/database'
import * as schema from '@backend/database/schema'
import type { SocketData } from '@common/models/socket.io'
import type { User } from '@common/models/user'
import { randomUUID } from 'node:crypto'
import AuthManager from '../managers/auth.manager'
import UserManager from '../managers/user.manager'
import type { TypedSocket } from '../server'

export async function clearDB() {
  database.transaction(() => {
    db.delete(schema.matches).run()
    db.delete(schema.stages).run()
    db.delete(schema.groupPlayers).run()
    db.delete(schema.groups).run()
    db.delete(schema.tournaments).run()
    db.delete(schema.sessions).run()
    db.delete(schema.users).run()
    db.delete(schema.sessionSignups).run()
  })
}

export async function createMockAdmin() {
  const password = randomUUID()
  const adminUser: User = {
    id: randomUUID(),
    email: 'admin@test.no',
    firstName: 'Admin',
    lastName: 'Test',
    shortName: 'Admin',
    role: 'admin',
    passwordHash: await AuthManager.hash(password),
    createdAt: new Date(),
    deletedAt: null,
    updatedAt: null,
  }

  db.insert(schema.users).values(adminUser).run()

  return {
    user: adminUser,
    password,
    socket: createMockSocket(adminUser.id),
  } satisfies {
    user: User
    password: string
    socket: TypedSocket
  }
}

export function createMockSocket(userId: string): TypedSocket {
  const token = AuthManager.sign(userId)
  return {
    id: randomUUID(),
    data: {
      userId: userId,
      token,
    } satisfies SocketData,
    handshake: {
      auth: {
        token,
      } as Record<string, string>,
    },
  } as TypedSocket
}

export async function registerMockUser(
  socket: TypedSocket,
  identifier?: number | string
) {
  const id = `${identifier ?? randomUUID().substring(0, 3)}`
  const idSuffix = `-${identifier}`
  const email = `user${idSuffix}@test.com`

  await UserManager.onRegister(socket, {
    type: 'RegisterRequest',
    email,
    firstName: 'Test',
    lastName: 'User' + idSuffix,
    shortName: id.toUpperCase(),
    password: randomUUID(),
  })

  return await UserManager.getUser(email)
}

export async function registerMockUsers(
  socket: TypedSocket,
  length: number,
  start: number = 1
) {
  return await Promise.all(
    Array.from({ length }, (_, i) => registerMockUser(socket, start + i))
  )
}
