import type { tracks } from '../../backend/database/schema'

export type Game = 'next' | 'turbo'
export type Platform = 'pc' | 'ps4' | 'xb1'
export type Track = typeof tracks.$inferSelect
export type CreateTrack = typeof tracks.$inferInsert
