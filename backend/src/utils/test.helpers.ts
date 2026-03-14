import db from '@backend/database/database'
import * as schema from '@backend/database/schema'
import type { Ranking } from '@common/models/ranking'
import type { SocketData } from '@common/models/socket.io'
import type { CreateTournament } from '@common/models/tournament'
import type { User } from '@common/models/user'
import { randomInt, randomUUID } from 'node:crypto'
import AuthManager from '../managers/auth.manager'
import RatingManager from '../managers/rating.manager'
import SessionManager from '../managers/session.manager'
import TournamentManager from '../managers/tournament.managers/tournament.manager'
import UserManager from '../managers/user.manager'
import type { TypedSocket } from '../server'

export async function clearDB() {
  await db.delete(schema.matches)
  await db.delete(schema.stages)
  await db.delete(schema.groups)
  await db.delete(schema.tournaments)
  await db.delete(schema.groupPlayers)
  await db.delete(schema.sessionSignups)
  await db.delete(schema.timeEntries)
  await db.delete(schema.users)
  await db.delete(schema.sessions)
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

export async function registerMockUser(socket: TypedSocket) {
  const uniqueId = randomUUID()
  const shortUuid = uniqueId.substring(0, 8)
  const email = `user-${shortUuid}@test.com`

  await UserManager.onRegister(socket, {
    type: 'RegisterRequest',
    email,
    firstName: 'Test',
    lastName: `User-${shortUuid}`,
    shortName: shortUuid.toUpperCase(),
    password: randomUUID(),
  })

  return await UserManager.getUser(email)
}

export async function registerMockUsers(socket: TypedSocket, length: number) {
  return await Promise.all(
    Array.from({ length }, (_, i) => registerMockUser(socket))
  )
}

export async function createSessionMock(
  socket: TypedSocket,
  participants: string[]
) {
  const sessionId = randomUUID()
  await SessionManager.onCreateSession(socket, {
    type: 'CreateSessionRequest',
    id: sessionId,
    name: 'test',
    date: new Date(),
  })

  await Promise.all(
    participants.map(p =>
      SessionManager.onRsvpSession(socket, {
        type: 'RsvpSessionRequest',
        session: sessionId,
        user: p,
        response: 'yes',
      })
    )
  )

  return sessionId
}

export function setupRatings(rankings: { userId: string; rating: number }[]) {
  const sortedRankings = rankings.toSorted((a, b) => a.rating - b.rating)

  const ratingsMap = new Map<string, Ranking>()
  for (let index = 0; index < sortedRankings.length; index++) {
    const r = sortedRankings[index]
    const matchRating = randomInt(r.rating)
    const trackRating = r.rating - matchRating

    ratingsMap.set(r.userId, {
      user: r.userId,
      ranking: index,
      totalRating: r.rating,
      matchRating,
      trackRating,
    })
  }

  // Use Object.defineProperty to set the private ratings property
  Object.defineProperty(RatingManager, 'ratings', {
    writable: true,
    value: ratingsMap,
  })
}

/**
 * Creates test tracks that can be used in tournaments
 */
export async function createTestTracks(count: number = 1) {
  const trackIds: string[] = []
  for (let i = 0; i < count; i++) {
    const trackId = randomUUID()
    await db.insert(schema.tracks).values({
      id: trackId,
      number: i + 1,
      level: 'white',
      type: 'stadium',
    })

    trackIds.push(trackId)
  }
  return trackIds
}

export async function createMockTournament(
  socket: TypedSocket,
  participantCount: number,
  tournamentSettings: Omit<CreateTournament, 'name' | 'session'>
) {
  const users = await registerMockUsers(socket, participantCount)

  setupRatings(
    users.map((u, idx) => ({
      userId: u.id,
      rating: users.length - idx,
    }))
  )

  const sessionId = await createSessionMock(
    socket,
    users.map(u => u.id)
  )

  const tournamentId = randomUUID()
  await TournamentManager.onCreateTournament(socket, {
    type: 'CreateTournamentRequest',
    id: tournamentId,
    session: sessionId,
    name: 'Test',
    ...tournamentSettings,
  })

  return tournamentId
}
