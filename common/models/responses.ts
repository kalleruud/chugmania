import type { UserDataResponse } from './user'

export type BackendResponse = ErrorResponse | SuccessResponse | UserDataResponse

export type SuccessResponse = {
  success: true
}

export type ErrorResponse = {
  success: false
  message: string
}
