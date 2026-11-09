import type { matches, timeEntries } from '../../backend/database/schema'

export type TimeEntryDraft = Omit<
  typeof timeEntries.$inferSelect,
  'webhookCapture'
>
export type MatchDraft = Omit<typeof matches.$inferSelect, 'webhookCapture'>
export type ResultDrafts = {
  timeEntries: TimeEntryDraft[]
  matches: MatchDraft[]
}
export type ResultDraftRequest = { kind: 'lap' | 'match'; id: string }
