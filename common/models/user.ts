import { users } from '../../backend/database/schema'

export type User = typeof users.$inferSelect
export type CreateUser = typeof users.$inferInsert
export type UserInfo = Omit<User, 'passwordHash'> & { passwordHash: undefined }

export function getUserFullName(
  user: Pick<UserInfo, 'firstName' | 'lastName'>
) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
}
