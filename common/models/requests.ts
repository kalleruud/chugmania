export type LoginRequest = {
  email: string
  password: string
}

export function isLoginRequest(data: any): data is LoginRequest {
  if (typeof data !== 'object') return false
  return data.email && data.password
}
