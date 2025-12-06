import { users } from '../../backend/database/schema'
import type { SocketData, SuccessResponse } from './socket.io'

export type User = typeof users.$inferSelect
export type CreateUser = typeof users.$inferInsert
export type UpdateUser = Partial<
  Omit<typeof users.$inferInsert, 'id' | 'passwordHash'>
> & {
  id: User['id']
  newPassword?: string
}
export type UserInfo = Omit<User, 'passwordHash'> & { passwordHash: undefined }

export function isUserInfo(data: any): data is UserInfo {
  if (typeof data !== 'object' || data === null) return false

  return (
    data.passwordHash === undefined &&
    typeof data.id === 'string' &&
    typeof data.email === 'string'
  )
}

export type LoginResponse = SuccessResponse & SocketData

export type EditUserRequest = UpdateUser & {
  type: 'EditUserRequest'
  password?: string
  role?: User['role']
  createdAt?: User['createdAt']
}

export function isEditUserRequest(data: any): data is EditUserRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'EditUserRequest' && typeof data.id === 'string'
}

export type DeleteUserRequest = {
  type: 'DeleteUserRequest'
  id: User['id']
}

export function isDeleteUserRequest(data: any): data is DeleteUserRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'DeleteUserRequest' && typeof data.id === 'string'
}

export function getUserFullName(
  user: Pick<UserInfo, 'firstName' | 'lastName'>
) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
}
