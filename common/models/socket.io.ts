import type { LoginRequest, RegisterRequest } from './auth'
import type { ErrorResponse } from './responses'
import type { UserDataResponse, UserInfo } from './user'

export interface ServerToClientEvents {
  emitUserData: (r: UserDataResponse | ErrorResponse) => void
}

export interface ClientToServerEvents {
  connect: () => void
  disconnect: () => void
  connect_error: (err: Error) => void
  login: (
    r: LoginRequest,
    callback: (r: UserDataResponse | ErrorResponse) => void
  ) => void
  register: (
    r: RegisterRequest,
    callback: (r: UserDataResponse | ErrorResponse) => void
  ) => void
  get_user_data: (
    callback: (r: UserDataResponse | ErrorResponse) => void
  ) => void
}

export interface InterServerEvents {
  ping: () => void
}

export interface SocketData {
  token: string
  user: UserInfo
}

// ---------- helpers & types ----------
type CallbackOf<F extends ClientToServerEvents> = Parameters<F["login"]>[0]

type RequestOf<F> =
  // no args
  F extends () => void ? undefined :
  // callback-only (first param is callback) => no request
  F extends (cb: any) => void ? undefined :
  // req + callback
  F extends (req: infer R, cb: any) => void ? R :
  // single-arg non-callback
  F extends (arg: infer A) => void ? A :
  never;

type ResponseOf<F> =
  CallbackOf<F> extends (res: infer R) => void ? R : undefined

type HasCallback<F> = CallbackOf<F> extends undefined ? false : true;

// --- helpers that accept an event key (Ev) ---
export type EventReq<Ev extends keyof ClientToServerEvents> =
  RequestOf<ClientToServerEvents[Ev]>;

export type EventCb<Ev extends keyof ClientToServerEvents> =
  CallbackOf<ClientToServerEvents[Ev]>;

export type EventRes<Ev extends keyof ClientToServerEvents> =
  ResponseOf<ClientToServerEvents[Ev]>;

export type EventHasCallback<Ev extends keyof ClientToServerEvents> =
  HasCallback<ClientToServerEvents[Ev]>;