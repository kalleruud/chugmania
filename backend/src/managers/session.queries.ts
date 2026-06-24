import type { SessionSignup, SessionWithSignups } from '@common/models/session'
import type { User, UserInfo } from '@common/models/user'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { sessions, sessionSignups, users } from '../../database/schema'

function toUserInfo(user: User): UserInfo {
  return { ...user, passwordHash: undefined }
}

export async function ensureSessionSignup(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const existingSignup = await db.query.sessionSignups.findFirst({
    where: and(
      eq(sessionSignups.session, sessionId),
      eq(sessionSignups.user, userId)
    ),
  })

  if (existingSignup && !existingSignup.deletedAt) return false

  await db
    .insert(sessionSignups)
    .values({
      id: existingSignup?.id,
      session: sessionId,
      user: userId,
      response: 'yes',
    })
    .onConflictDoUpdate({
      target: [sessionSignups.id],
      set: { response: 'yes', deletedAt: null },
    })

  return true
}

export async function getAllSessions(): Promise<SessionWithSignups[]> {
  const sessionRows = await db
    .select()
    .from(sessions)
    .where(isNull(sessions.deletedAt))
    .orderBy(desc(sessions.date), asc(sessions.createdAt))

  if (sessionRows.length === 0) {
    console.debug(
      new Date().toISOString(),
      loc.no.error.messages.not_in_db('sessions')
    )
    return []
  }

  return Promise.all(
    sessionRows.map(async session => ({
      ...session,
      signups: await getSessionSignups(session.id),
    }))
  )
}

export async function getSession(
  id: string
): Promise<SessionWithSignups | null> {
  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, id), isNull(sessions.deletedAt)),
  })

  if (!session) {
    console.warn(new Date().toISOString(), loc.no.error.messages.not_in_db(id))
    return null
  }

  return {
    ...session,
    signups: await getSessionSignups(session.id),
  }
}

export async function getSessionSignups(
  sessionId: string
): Promise<SessionSignup[]> {
  const signupRows = await db
    .select({
      id: sessionSignups.id,
      createdAt: sessionSignups.createdAt,
      updatedAt: sessionSignups.updatedAt,
      deletedAt: sessionSignups.deletedAt,
      response: sessionSignups.response,
      session: sessionSignups.session,
      user: users,
    })
    .from(sessionSignups)
    .innerJoin(users, eq(sessionSignups.user, users.id))
    .where(
      and(
        eq(sessionSignups.session, sessionId),
        isNull(users.deletedAt),
        isNull(sessionSignups.deletedAt)
      )
    )
    .orderBy(asc(sessionSignups.createdAt))

  if (signupRows.length === 0) {
    return []
  }

  return signupRows.map(row => ({
    ...row,
    user: toUserInfo(row.user),
  }))
}
