import { type UserInfo } from './user'

export type LoginRequest = {
  type: 'LoginRequest'
  email: UserInfo['email']
  password: string
}

export function isLoginRequest(data: any): data is LoginRequest {
  if (typeof data !== 'object') return false
  return data.email && data.password && data.type === 'LoginRequest'
}

export type RegisterRequest = Omit<
  UserInfo,
  'id' | 'role' | 'updatedAt' | 'createdAt' | 'deletedAt' | 'passwordHash'
> &
  Omit<LoginRequest, 'type'> & {
    type: 'RegisterRequest'
    role?: UserInfo['role']
    createdAt?: UserInfo['createdAt']
  }

export function isRegisterRequest(data: any): data is RegisterRequest {
  if (typeof data !== 'object' || data !== null) return false
  return (
    data.type === 'RegisterRequest' &&
    typeof data.email === 'string' &&
    typeof data.password === 'string' &&
    typeof data.firstName === 'string' &&
    typeof data.lastName === 'string' &&
    typeof data.shortName === 'string'
  )
}
