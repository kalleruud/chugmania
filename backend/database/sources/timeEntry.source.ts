import type { Session } from '@common/models/session'
import type { CreateTimeEntry, TimeEntry } from '@common/models/timeEntry'
import type { TournamentState } from '@common/models/tournament'
import type { User } from '@common/models/user'
import { and, asc, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import db from '../database'
import { timeEntries } from '../schema'
import TransactionSource from './transaction.source'

export default class TimeEntrySource {
  static readonly table = timeEntries
  static async import(data: (typeof TimeEntrySource.table.$inferInsert)[]) {
    const tasks = data.map(d =>
      db
        .insert(TimeEntrySource.table)
        .values(data)
        .onConflictDoUpdate({ target: TimeEntrySource.table.id, set: d })
        .returning()
    )

    return (await Promise.all(tasks)).flat()
  }

  // Returns all latest lap times for each user after a session.
  static getAllLatestAfterSession(sessionId: Session['id']): TimeEntry[] {
    const latestDatePerUser = db
      .select({
        user: timeEntries.user,
        maxDate: sql<Date>`max(${timeEntries.createdAt})`.as('maxDate'),
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.session, sessionId),
          isNull(timeEntries.deletedAt),
          eq(timeEntries.status, 'completed')
        )
      )
      .groupBy(timeEntries.user)
      .as('latest_date')

    const latestBestPerUser = db
      .select({
        user: timeEntries.user,
        createdAt: timeEntries.createdAt,
        minDuration: sql<number>`min(${timeEntries.duration})`.as(
          'minDuration'
        ),
      })
      .from(timeEntries)
      .innerJoin(
        latestDatePerUser,
        and(
          eq(timeEntries.user, latestDatePerUser.user),
          eq(timeEntries.createdAt, latestDatePerUser.maxDate)
        )
      )
      .where(
        and(
          eq(timeEntries.session, sessionId),
          isNull(timeEntries.deletedAt),
          eq(timeEntries.status, 'completed')
        )
      )
      .groupBy(timeEntries.user, timeEntries.createdAt)
      .as('latest_best')

    return db
      .select({ ...getTableColumns(timeEntries) })
      .from(timeEntries)
      .innerJoin(
        latestBestPerUser,
        and(
          eq(timeEntries.user, latestBestPerUser.user),
          eq(timeEntries.createdAt, latestBestPerUser.createdAt),
          eq(timeEntries.duration, latestBestPerUser.minDuration)
        )
      )
      .where(
        and(
          eq(timeEntries.session, sessionId),
          isNull(timeEntries.deletedAt),
          eq(timeEntries.status, 'completed')
        )
      )
      .all()
  }

  static findById(id: string): TimeEntry | undefined {
    return db.select().from(timeEntries).where(eq(timeEntries.id, id)).get()
  }

  static create(entry: CreateTimeEntry): void {
    db.insert(timeEntries).values(entry).run()
  }

  static update(id: string, updates: Partial<CreateTimeEntry>): void {
    db.update(timeEntries).set(updates).where(eq(timeEntries.id, id)).run()
  }
  static deleteTimeEntriesForUser(userId: User['id']): void {
    const deletedAt = new Date()
    db.update(timeEntries)
      .set({ deletedAt })
      .where(eq(timeEntries.user, userId))
      .run()
  }

  static async getAll(): Promise<TimeEntry[]> {
    return await db
      .select()
      .from(timeEntries)
      .where(isNull(timeEntries.deletedAt))
      .orderBy(
        asc(
          sql`CASE WHEN ${timeEntries.duration} IS NULL OR ${timeEntries.duration} = 0 THEN 1 ELSE 0 END`
        ),
        asc(timeEntries.duration),
        asc(timeEntries.createdAt)
      )
  }
  static findByCapture(capture: string) {
    return db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.webhookCapture, capture))
      .get()
  }
  static getTieBreakers(session: string, track: string): TimeEntry[] {
    return db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.session, session),
          eq(timeEntries.track, track),
          eq(timeEntries.tieBreaker, true)
        )
      )
      .all()
  }
  static reconcileTieBreakers(
    state: TournamentState,
    needs: Map<string, boolean>
  ): void {
    TransactionSource.run(() => {
      const track = state.config.tieBreakerTrack
      if (!track) return
      const laps = new Map(state.tieBreakers.map(lap => [lap.user, lap]))
      for (const user of needs.keys()) {
        if (!laps.has(user))
          db.insert(timeEntries)
            .values({
              user,
              track,
              session: state.config.session,
              tieBreaker: true,
              status: 'planned',
            })
            .run()
      }
      for (const lap of state.tieBreakers) {
        if (
          !lap.user ||
          lap.status !== 'planned' ||
          !!lap.deletedAt === !needs.has(lap.user)
        )
          continue
        db.update(timeEntries)
          .set({ deletedAt: needs.has(lap.user) ? null : new Date() })
          .where(eq(timeEntries.id, lap.id))
          .run()
      }
    })
  }
}
