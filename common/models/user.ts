import { users } from '../../backend/database/schema'

export type User = typeof users.$inferSelect
export type CreateUser = typeof users.$inferInsert
export type UserInfo = Omit<User, 'passwordHash'> & { passwordHash: undefined }
