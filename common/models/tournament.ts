import type {
  EliminationType,
  MatchStage,
  TournamentBracket,
} from '../../backend/database/schema'
import type { TournamentWorkloadSummary } from '../tournament/workload'
import type { Match } from './match'
import type { TimeEntry } from './timeEntry'
import type { UserInfo } from './user'

export type SlotDependency =
  | { kind: 'group_rank'; groupId: string; rank: number }
  | { kind: 'match_winner'; matchId: string }
  | { kind: 'match_loser'; matchId: string }

export type TournamentStageTracksConfig = Partial<
  Record<MatchStage, string[] | undefined>
>

export type PreviewTournamentRequest = {
  type: 'PreviewTournamentRequest'
  sessionId: string
  name: string
  description?: string | null
  qualificationTrackId: string
  groupsCount: number
  advancementCount: number
  eliminationType: EliminationType
  stageTracks: TournamentStageTracksConfig
}

export function isPreviewTournamentRequest(
  data: unknown
): data is PreviewTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  const d = data as PreviewTournamentRequest
  return (
    d.type === 'PreviewTournamentRequest' &&
    typeof d.sessionId === 'string' &&
    typeof d.qualificationTrackId === 'string' &&
    typeof d.groupsCount === 'number' &&
    typeof d.advancementCount === 'number'
  )
}

export type CreateTournamentRequest = {
  type: 'CreateTournamentRequest'
} & Omit<PreviewTournamentRequest, 'type'>

export function isCreateTournamentRequest(
  data: unknown
): data is CreateTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  const d = data as CreateTournamentRequest
  return (
    d.type === 'CreateTournamentRequest' &&
    typeof d.sessionId === 'string' &&
    typeof d.name === 'string' &&
    d.name.trim().length > 0
  )
}

export type DeleteTournamentRequest = {
  type: 'DeleteTournamentRequest'
  sessionId: string
}

export function isDeleteTournamentRequest(
  data: unknown
): data is DeleteTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  const d = data as DeleteTournamentRequest
  return d.type === 'DeleteTournamentRequest' && typeof d.sessionId === 'string'
}

export type TournamentQualificationRow = {
  userId: string
  user: UserInfo
  rank: number
  pending: boolean
  bestDurationMs: number | null
  timeEntry: TimeEntry | null
}

export type TournamentGroupStandingRow = {
  userId: string
  user: UserInfo
  rank: number
  wins: number
  losses: number
  qualificationRank: number
  qualifies: boolean
}

export type TournamentGroupBlock = {
  id: string
  name: string
  memberUserIds: string[]
  standings: TournamentGroupStandingRow[]
}

export type TournamentMatchDetail = {
  id: string
  tournamentMatchId: string
  name: string
  bracket: TournamentBracket
  stage: MatchStage
  stageLabel: string
  sortOrder: number
  match: Match | null
  trackId: string | null
  readOnly: boolean
  slot1Label: string | null
  slot2Label: string | null
  slot1Dependency: SlotDependency | null
  slot2Dependency: SlotDependency | null
}

export type TournamentDetails = {
  id: string
  sessionId: string
  name: string
  description: string | null
  qualificationTrackId: string
  groupsCount: number
  advancementCount: number
  eliminationType: EliminationType
  usedStages: MatchStage[]
  qualification: TournamentQualificationRow[]
  groups: TournamentGroupBlock[]
  matches: TournamentMatchDetail[]
  progress: {
    completedTournamentMatches: number
    totalTournamentMatches: number
    groupMatchesCompleted: number
    groupMatchesTotal: number
  }
  workloadSummary: TournamentWorkloadSummary
  isPreview: boolean
}

export type PreviewTournamentResponse =
  | { success: true; details: TournamentDetails }
  | { success: false; message: string }

export type CreateTournamentResponse =
  | { success: true }
  | { success: false; message: string }

export type DeleteTournamentResponse =
  | { success: true }
  | { success: false; message: string }
