import type { LoginRequest, RegisterRequest } from "../models/auth"
import type { UserDataResponse } from "../models/user"



export type WS_EVENT = {
  connect: () => void
  disconnect: () => void
  connect_error: () => Error
  login: (r: LoginRequest) => UserDataResponse
  register: (r: RegisterRequest) => UserDataResponse
}

export const AUTH_KEY = 'auth'
