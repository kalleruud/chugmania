import type { EntryStatus } from '@common/models/entry'
import { and, asc, desc, eq, gt, gte, isNull, lte, ne } from 'drizzle-orm'
import db from '../database'
import {
  matches,
  sessions,
  timeEntries,
  tracks,
  webhookCaptures,
  webhookEvents,
} from '../schema'

export type WebhookCapture = typeof webhookCaptures.$inferSelect

export default class WebhookSource {
  static findSession(now: Date, earliest: Date, id?: string) {
    return db
      .select()
      .from(sessions)
      .where(
        and(
          isNull(sessions.deletedAt),
          ne(sessions.status, 'cancelled'),
          lte(sessions.date, now),
          gte(sessions.date, earliest),
          id ? eq(sessions.id, id) : undefined
        )
      )
      .orderBy(desc(sessions.date), asc(sessions.id))
      .get()
  }
  static findNextSession(now: Date) {
    return db
      .select()
      .from(sessions)
      .where(
        and(
          isNull(sessions.deletedAt),
          ne(sessions.status, 'cancelled'),
          gt(sessions.date, now)
        )
      )
      .orderBy(asc(sessions.date), asc(sessions.id))
      .get()
  }
  static getEvents(capture: string) {
    return db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.capture, capture))
      .orderBy(asc(webhookEvents.sequence))
      .all()
  }
  static findEvent(eventId: string) {
    return db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, eventId))
      .get()
  }
  static findCapture(gameId: string) {
    return db
      .select()
      .from(webhookCaptures)
      .where(eq(webhookCaptures.gameId, gameId))
      .get()
  }
  static createCapture(capture: typeof webhookCaptures.$inferInsert) {
    return db.insert(webhookCaptures).values(capture).returning().get()
  }
  static hasSequence(capture: string, sequence: number): boolean {
    return !!db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.capture, capture),
          eq(webhookEvents.sequence, sequence)
        )
      )
      .get()
  }
  static createEvent(event: typeof webhookEvents.$inferInsert): void {
    db.insert(webhookEvents).values(event).run()
  }
  static markEnded(capture: string, endedAt: Date): void {
    db.update(webhookCaptures)
      .set({ endedAt })
      .where(eq(webhookCaptures.id, capture))
      .run()
  }
  static getResultRows(capture: string) {
    return {
      lap: db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.webhookCapture, capture))
        .get(),
      match: db
        .select()
        .from(matches)
        .where(eq(matches.webhookCapture, capture))
        .get(),
    }
  }
  static findTrack(uid: string) {
    return db
      .select()
      .from(tracks)
      .where(and(eq(tracks.uid, uid), isNull(tracks.deletedAt)))
      .get()
  }
  static createTrack(track: typeof tracks.$inferInsert) {
    return db.insert(tracks).values(track).returning().get()
  }
  static createLap(entry: typeof timeEntries.$inferInsert): void {
    db.insert(timeEntries).values(entry).run()
  }
  static createMatch(entry: typeof matches.$inferInsert): void {
    db.insert(matches).values(entry).run()
  }
  static updateLapTimes(
    capture: string,
    status: EntryStatus,
    duration: number | null,
    chugDurationMs: number | null
  ): void {
    db.update(timeEntries)
      .set({ status, duration, chugDurationMs })
      .where(eq(timeEntries.webhookCapture, capture))
      .run()
  }
  static updateMatchTimes(
    capture: string,
    values: Partial<typeof matches.$inferInsert>
  ): void {
    db.update(matches)
      .set(values)
      .where(eq(matches.webhookCapture, capture))
      .run()
  }
}
