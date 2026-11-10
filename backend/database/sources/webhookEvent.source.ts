import { and, asc, eq } from 'drizzle-orm'
import db from '../database'
import { webhookEvents } from '../schema'

export default class WebhookEventSource {
  static getByCapture(capture: string) {
    return db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.capture, capture))
      .orderBy(asc(webhookEvents.sequence))
      .all()
  }
  static findByEventId(eventId: string) {
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
  static create(event: typeof webhookEvents.$inferInsert): void {
    db.insert(webhookEvents).values(event).run()
  }
}
