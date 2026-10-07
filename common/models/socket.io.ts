import type {
  ExportCsvRequest,
  ExportCsvResponse,
  ImportCsvRequest,
  ImportCsvResponse,
} from '@common/models/importCsv'
import type { LoginRequest, RegisterRequest } from './auth'
import type {
  CreateMatchRequest,
  DeleteMatchRequest,
  EditMatchRequest,
  Match,
} from './match'
import type {
  CreateSessionRequest,
  DeleteSessionRequest,
  EditSessionRequest,
  RsvpSessionRequest,
  SessionWithSignups,
} from './session'
import type {
  AbsoluteTimeEntriesRequest,
  AbsoluteTimeEntriesResponse,
  CreateTimeEntryRequest,
  EditTimeEntryRequest,
  TimeEntry,
} from './timeEntry'
import type {
  DeleteTournamentRequest,
  RenameTournamentGroupRequest,
  StartTournamentRequest,
  TournamentConflictResponse,
  TournamentDetails,
  TournamentRequest,
  UpdateTournamentRequest,
} from './tournament'
import type { Track } from './track'
import type {
  DeleteUserRequest,
  EditUserRequest,
  LoginResponse,
  UserInfo,
} from './user'
import type {
  WebhookAssignRequest,
  WebhookClaimRequest,
  WebhookDrafts,
  WebhookGameRequest,
  WebhookTrackRequest,
} from './webhook'

export type SuccessResponse = {
  success: true
}

export type ErrorResponse = {
  success: false
  message: string
}

import type { Ranking } from './ranking'

export interface ServerToClientEvents {
  webhook_drafts_changed: (data: WebhookDrafts, actor?: string | null) => void
  all_tournaments: (
    tournaments: TournamentDetails[],
    actor?: string | null
  ) => void
  user_data: (r: EventRes<'get_user_data'>) => void
  all_users: (r: UserInfo[]) => void
  all_tracks: (r: Track[]) => void
  all_time_entries: (r: TimeEntry[]) => void
  all_sessions: (r: SessionWithSignups[]) => void
  all_matches: (r: Match[]) => void
  all_rankings: (r: Ranking[]) => void
}

export interface ClientToServerEvents {
  get_webhook_drafts: (
    request: { session: string },
    callback: (
      response: (SuccessResponse & WebhookDrafts) | ErrorResponse
    ) => void
  ) => void
  claim_webhook_player: (
    request: WebhookClaimRequest,
    callback: (response: SuccessResponse | ErrorResponse) => void
  ) => void
  assign_webhook_player: (
    request: WebhookAssignRequest,
    callback: (response: SuccessResponse | ErrorResponse) => void
  ) => void
  select_webhook_track: (
    request: WebhookTrackRequest,
    callback: (response: SuccessResponse | ErrorResponse) => void
  ) => void
  create_webhook_track: (
    request: WebhookGameRequest,
    callback: (response: SuccessResponse | ErrorResponse) => void
  ) => void
  publish_webhook_draft: (
    request: WebhookGameRequest,
    callback: (response: SuccessResponse | ErrorResponse) => void
  ) => void
  discard_webhook_draft: (
    request: WebhookGameRequest,
    callback: (response: SuccessResponse | ErrorResponse) => void
  ) => void
  get_webhook_events: (
    request: WebhookGameRequest,
    callback: (
      response:
        | (SuccessResponse & {
            gameId: string
            events: { eventId: string; sequence: number; rawPayload: string }[]
          })
        | ErrorResponse
    ) => void
  ) => void

  create_tournament: (
    request: TournamentRequest,
    callback: (
      response:
        | { success: true; details: TournamentDetails | null }
        | ErrorResponse
    ) => void
  ) => void
  update_tournament: (
    request: UpdateTournamentRequest,
    callback: (
      response:
        | { success: true; details: TournamentDetails | null }
        | ErrorResponse
        | TournamentConflictResponse
    ) => void
  ) => void
  start_tournament: (
    request: StartTournamentRequest,
    callback: (
      response:
        | { success: true; details: TournamentDetails | null }
        | ErrorResponse
        | TournamentConflictResponse
    ) => void
  ) => void
  get_tournament: (
    request: TournamentRequest,
    callback: (
      response:
        | { success: true; details: TournamentDetails | null }
        | ErrorResponse
    ) => void
  ) => void
  rename_tournament_group: (
    request: RenameTournamentGroupRequest,
    callback: (
      response: { success: true; details: TournamentDetails } | ErrorResponse
    ) => void
  ) => void
  delete_tournament: (
    request: DeleteTournamentRequest,
    callback: (
      response: { success: true; details: null } | ErrorResponse
    ) => void
  ) => void

  connect: () => void
  disconnect: () => void
  connect_error: (err: Error) => void
  login: (
    r: LoginRequest,
    callback: (r: LoginResponse | ErrorResponse) => void
  ) => void
  register: (
    r: RegisterRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  get_user_data: (callback: (r: LoginResponse | ErrorResponse) => void) => void
  edit_user: (
    r: EditUserRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  delete_user: (
    r: DeleteUserRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  post_time_entry: (
    r: CreateTimeEntryRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  edit_time_entry: (
    r: EditTimeEntryRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  create_session: (
    r: CreateSessionRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  edit_session: (
    r: EditSessionRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  rsvp_session: (
    r: RsvpSessionRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  delete_session: (
    r: DeleteSessionRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  import_csv: (
    r: ImportCsvRequest,
    callback: (r: ImportCsvResponse | ErrorResponse) => void
  ) => void
  export_csv: (
    r: ExportCsvRequest,
    callback: (r: ExportCsvResponse | ErrorResponse) => void
  ) => void
  get_absolute_time_entries: (
    r: AbsoluteTimeEntriesRequest,
    callback: (r: AbsoluteTimeEntriesResponse | ErrorResponse) => void
  ) => void
  create_match: (
    r: CreateMatchRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  edit_match: (
    r: EditMatchRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  delete_match: (
    r: DeleteMatchRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
}

export interface InterServerEvents {
  ping: () => void
}

export interface SocketData {
  token: string
  userId: string
}

// ---------- helpers & types ----------
type RequestOf<F> = F extends (...args: infer P) => void
  ? P extends [infer R, infer C]
    ? C extends (...args: never[]) => unknown
      ? R
      : never
    : P extends [infer C]
      ? C extends (...args: never[]) => unknown
        ? undefined
        : C
      : undefined
  : never

type CallbackOf<F> = F extends (...args: infer P) => void
  ? P extends [unknown, infer C]
    ? C
    : P extends [infer C]
      ? C extends (...args: never[]) => unknown
        ? C
        : undefined
      : undefined
  : undefined

type ResponseOf<F> =
  CallbackOf<F> extends (res: infer R) => void ? R : undefined

type HasCallback<F> = CallbackOf<F> extends undefined ? false : true

// --- helpers that accept an event key (Ev) ---
export type EventReq<Ev extends keyof ClientToServerEvents> = RequestOf<
  ClientToServerEvents[Ev]
>

export type EventCb<Ev extends keyof ClientToServerEvents> = CallbackOf<
  ClientToServerEvents[Ev]
>

export type EventRes<Ev extends keyof ClientToServerEvents> = ResponseOf<
  ClientToServerEvents[Ev]
>

export type EventHasCallback<Ev extends keyof ClientToServerEvents> =
  HasCallback<ClientToServerEvents[Ev]>
