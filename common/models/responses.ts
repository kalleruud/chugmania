export type BackendResponse = LoginSuccessResponse | ErrorResponse

export type LoginSuccessResponse = {
  isSuccess: true
  token: string
}

export type ErrorResponse = {
  isSuccess: false
  error: Error
}
