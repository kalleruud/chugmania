import { users } from '../../backend/database/schema'
import type { SuccessResponse } from './responses'

export const WS_BROADCAST_USERS = 'UserBroadcast'
export const WS_BROADCAST_USER_DATA = 'UserDataBroadcast'
export type UserBroadcast = UserInfo[]
export type UserDataResponse = SuccessResponse & {
  token: string
  userInfo: UserInfo
}

export type User = typeof users.$inferSelect
export type CreateUser = typeof users.$inferInsert
export type UpdateUser = Omit<typeof users.$inferInsert, 'id'> & {
  id: User['id']
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

export function getUserFullName(
  user: Pick<UserInfo, 'firstName' | 'lastName'>
) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
}
