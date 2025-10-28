import { users } from '../../backend/database/schema'

export type User = typeof users.$inferSelect
export type CreateUser = typeof users.$inferInsert
export type UserInfo = Omit<User, 'passwordHash'> & { passwordHash: undefined }

export function isUserInfo(data: any): data is UserInfo {
  if (typeof data !== 'object' || data === null) {
    return false
  }
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
