import { isRecord } from '../utils/is-record'
import { type UserInfo } from './user'

export type LoginRequest = {
  type: 'LoginRequest'
  email: UserInfo['email']
  password: string
}

export function isLoginRequest(data: unknown): data is LoginRequest {
  if (!isRecord(data)) return false
  return (
    data.type === 'LoginRequest' &&
    typeof data.email === 'string' &&
    typeof data.password === 'string'
  )
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

export function isRegisterRequest(data: unknown): data is RegisterRequest {
  if (!isRecord(data)) return false
  return (
    data.type === 'RegisterRequest' &&
    typeof data.email === 'string' &&
    typeof data.password === 'string' &&
    typeof data.firstName === 'string' &&
    typeof data.lastName === 'string' &&
    typeof data.shortName === 'string'
  )
}
