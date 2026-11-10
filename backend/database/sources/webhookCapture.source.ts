import { eq } from 'drizzle-orm'
import db from '../database'
import { webhookCaptures } from '../schema'

export type WebhookCapture = typeof webhookCaptures.$inferSelect

export default class WebhookCaptureSource {
  static findByGameId(gameId: string) {
    return db
      .select()
      .from(webhookCaptures)
      .where(eq(webhookCaptures.gameId, gameId))
      .get()
  }
  static create(capture: typeof webhookCaptures.$inferInsert) {
    return db.insert(webhookCaptures).values(capture).returning().get()
  }
  static markEnded(capture: string, endedAt: Date): void {
    db.update(webhookCaptures)
      .set({ endedAt })
      .where(eq(webhookCaptures.id, capture))
      .run()
  }
}
