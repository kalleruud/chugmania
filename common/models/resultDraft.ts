import type { matches, timeEntries } from '../../backend/database/schema'

type DraftMetadata = { hasMapMetadata?: boolean }

export type TimeEntryDraft = DraftMetadata &
  Omit<typeof timeEntries.$inferSelect, 'webhookCapture'>
export type MatchDraft = DraftMetadata &
  Omit<typeof matches.$inferSelect, 'webhookCapture'>
export type ResultDrafts = {
  timeEntries: TimeEntryDraft[]
  matches: MatchDraft[]
}
export type ResultDraftRequest = { kind: 'lap' | 'match'; id: string }
