import { and, asc, count, eq, gt, isNull, or } from 'drizzle-orm'
import db from '../database'
import { apiTokens, users } from '../schema'

export type ApiTokenRow = typeof apiTokens.$inferSelect

export default class ApiTokenSource {
  static findActiveById(id: string): ApiTokenRow | undefined {
    return db
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.id, id), isNull(apiTokens.deletedAt)))
      .get()
  }

  static findByName(user: string, name: string): ApiTokenRow | undefined {
    return db
      .select()
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.user, user),
          eq(apiTokens.name, name),
          isNull(apiTokens.deletedAt)
        )
      )
      .get()
  }

  static listForUser(user: string): ApiTokenRow[] {
    return db
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.user, user), isNull(apiTokens.deletedAt)))
      .orderBy(asc(apiTokens.createdAt), asc(apiTokens.id))
      .all()
  }

  static listAll(): ApiTokenRow[] {
    return db
      .select({ token: apiTokens })
      .from(apiTokens)
      .innerJoin(users, eq(apiTokens.user, users.id))
      .where(and(isNull(apiTokens.deletedAt), isNull(users.deletedAt)))
      .orderBy(asc(apiTokens.createdAt), asc(apiTokens.id))
      .all()
      .map(row => row.token)
  }

  static countActive(user: string, now: Date): number {
    return (
      db
        .select({ value: count() })
        .from(apiTokens)
        .where(
          and(
            eq(apiTokens.user, user),
            isNull(apiTokens.deletedAt),
            or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now))
          )
        )
        .get()?.value ?? 0
    )
  }

  static create(token: typeof apiTokens.$inferInsert): ApiTokenRow {
    return db.insert(apiTokens).values(token).returning().get()
  }

  static revoke(id: string, now: Date): void {
    db.update(apiTokens)
      .set({ deletedAt: now })
      .where(and(eq(apiTokens.id, id), isNull(apiTokens.deletedAt)))
      .run()
  }

  static touch(id: string, now: Date): void {
    db.update(apiTokens)
      .set({ lastUsedAt: now })
      .where(eq(apiTokens.id, id))
      .run()
  }
}
