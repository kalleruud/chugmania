export type BackendResponse = LoginSuccessResponse | RegisterSuccessResponse | ErrorResponse

export type LoginSuccessResponse = {
  success: true
  token: string
}

export type RegisterSuccessResponse = {
  success: true
  token: string
}

export function isRegisterSuccessResponse(data: any): data is RegisterSuccessResponse {
  if (typeof data !== 'object') return false
  return data.success && data.token
}

export function isLoginSuccessResponse(
  data: any
): data is LoginSuccessResponse {
  if (typeof data !== 'object') return false
  return data.success && data.token
}

export type ErrorResponse = {
  success: false
  message: string
}

export function isErrorResponse(data: any): data is ErrorResponse {
  if (typeof data !== 'object') return false
  return data.success === false && data.message
}
