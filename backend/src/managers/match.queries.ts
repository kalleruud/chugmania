import type { Match } from '@common/models/match'
import { and, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import db from '../../database/database'
import { matches, sessions } from '../../database/schema'

export async function getAllMatches(): Promise<Match[]> {
  return await db
    .select({ ...getTableColumns(matches) })
    .from(matches)
    .leftJoin(sessions, eq(matches.session, sessions.id))
    .where(isNull(matches.deletedAt))
    .orderBy(desc(sql`COALESCE(${sessions.date}, ${matches.createdAt})`))
}

export async function getAllMatchesBySession(
  sessionId: string
): Promise<Match[]> {
  return await db
    .select({ ...getTableColumns(matches) })
    .from(matches)
    .where(and(eq(matches.session, sessionId), isNull(matches.deletedAt)))
    .orderBy(desc(matches.createdAt))
}
