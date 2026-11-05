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
export type ResultDraftClaimRequest = ResultDraftRequest & {
  playerIndex: number
  release?: boolean
}
export type ResultDraftAssignRequest = ResultDraftRequest & {
  playerIndex: number
  user: string | null
}
export type ResultDraftTimeRequest = ResultDraftRequest & {
  playerIndex: number
  finishDurationMs?: number | null
  chugDurationMs?: number | null
}
export type ResultDraftTrackRequest = ResultDraftRequest & { track: string }
