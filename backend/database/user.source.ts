import type { User } from '@common/models/user'
import { and, eq, isNull } from 'drizzle-orm'
import db from './database'
import { users } from './schema'

export default class UserSource {
  static getActiveById(id: string): User | undefined {
    return db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .get()
  }
}
