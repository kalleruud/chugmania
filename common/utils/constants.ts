import type { LoginRequest, RegisterRequest } from '../models/auth'
import type { LoginResponse } from '../models/user'

export type WS_EVENT = {
  connect: () => void
  disconnect: () => void
  connect_error: () => Error
  login: (r: LoginRequest) => LoginResponse
  register: (r: RegisterRequest) => LoginResponse
}

export const AUTH_KEY = 'auth'
