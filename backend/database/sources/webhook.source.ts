import { and, asc, eq } from 'drizzle-orm'
import db from '../database'
import { webhookCaptures, webhookEvents } from '../schema'

export type WebhookCapture = typeof webhookCaptures.$inferSelect

export default class WebhookSource {
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
  static markEnded(capture: string, endedAt: Date): void {
    db.update(webhookCaptures)
      .set({ endedAt })
      .where(eq(webhookCaptures.id, capture))
      .run()
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
}
