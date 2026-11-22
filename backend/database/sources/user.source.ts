import type { User } from '@common/models/user'
import { and, eq, isNull } from 'drizzle-orm'
import db from '../database'
import { users } from '../schema'

export default class UserSource {
  static getActiveNames() {
    return db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        shortName: users.shortName,
      })
      .from(users)
      .where(isNull(users.deletedAt))
      .all()
  }

  static getActiveById(id: string): User | undefined {
    return db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .get()
  }
}
