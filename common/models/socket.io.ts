import type {
  ExportCsvRequest,
  ExportCsvResponse,
  ImportCsvRequest,
} from '../../common/models/importCsv'
import type { LoginRequest, RegisterRequest } from './auth'
import type {
  CreateSessionRequest,
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
import type { Track } from './track'
import type { EditUserRequest, LoginResponse, UserInfo } from './user'

export type SuccessResponse = {
  success: true
}

export type ErrorResponse = {
  success: false
  message: string
}

export interface ServerToClientEvents {
  user_data: (r: EventRes<'get_user_data'>) => void
  all_users: (r: UserInfo[]) => void
  all_tracks: (r: Track[]) => void
  all_time_entries: (r: TimeEntry[]) => void
  all_sessions: (r: SessionWithSignups[]) => void
}

export interface ClientToServerEvents {
  connect: () => void
  disconnect: () => void
  connect_error: (err: Error) => void
  login: (
    r: LoginRequest,
    callback: (r: LoginResponse | ErrorResponse) => void
  ) => void
  register: (
    r: RegisterRequest,
    callback: (r: LoginResponse | ErrorResponse) => void
  ) => void
  get_user_data: (callback: (r: LoginResponse | ErrorResponse) => void) => void
  edit_user: (
    r: EditUserRequest,
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
  import_csv: (
    r: ImportCsvRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  export_csv: (
    r: ExportCsvRequest,
    callback: (r: ExportCsvResponse | ErrorResponse) => void
  ) => void
  get_absolute_time_entries: (
    r: AbsoluteTimeEntriesRequest,
    callback: (r: AbsoluteTimeEntriesResponse | ErrorResponse) => void
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
type RequestOf<F> =
  // no args
  F extends () => void
    ? undefined
    : // callback-only (first param is callback) => no request
      F extends (cb: any) => void
      ? undefined
      : // req + callback
        F extends (req: infer R, cb: any) => void
        ? R
        : // single-arg non-callback
          F extends (arg: infer A) => void
          ? A
          : never

type CallbackOf<F> =
  // callback-only
  F extends (cb: infer C) => void
    ? C
    : // req + callback
      F extends (req: any, cb: infer C) => void
      ? C
      : undefined

type ResponseOf<F> = CallbackOf<F> extends (res: infer R) => void ? R : void

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
