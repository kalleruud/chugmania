import type { tracks } from '../../backend/database/schema'

export type Game = 'next' | 'turbo'
export type Track = typeof tracks.$inferSelect
export type CreateTrack = typeof tracks.$inferInsert
