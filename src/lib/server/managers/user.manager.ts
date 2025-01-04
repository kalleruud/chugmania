import db from '$lib/server/db'
import type { LookupEntity } from '@/components/lookup/lookup.server'
import { hash } from '@/utils'
import { and, eq, isNull } from 'drizzle-orm'
import { sessions, timeEntries, users } from '../db/schema'
import SessionManager from './session.manager'

type User = typeof users.$inferSelect
export type PublicUser = Omit<User, 'passwordHash'> & {
  shortName: string
  passwordHash: undefined
}

export default class UserManager {
  static readonly table = users

  static isUser(user: unknown): user is PublicUser {
    if (!user) return false
    if (!(user instanceof Object)) return false
    return 'email' in user && 'name' in user
  }

  static async getUser(email: string): Promise<User | undefined> {
    return await db.query.users.findFirst({ where: eq(users.email, email) })
  }

  static async getAll(): Promise<PublicUser[]> {
    return (await db.select().from(users)).map(this.getDetails)
  }

  static async getUsersFromSession(sessionId: string): Promise<PublicUser[]> {
    const items = await db
      .select()
      .from(users)
      .innerJoin(sessions, eq(timeEntries.session, sessionId))
      .innerJoin(timeEntries, eq(users.id, timeEntries.user))
      .where(
        and(isNull(users.deletedAt), isNull(sessions.deletedAt), isNull(timeEntries.deletedAt))
      )

    return items.map(item => this.getDetails(item.users))
  }

  static async getAllLookup(): Promise<LookupEntity[]> {
    const latestSession = await SessionManager.getMostRecent()
    const latestUsers = latestSession ? await this.getUsersFromSession(latestSession.id) : []

    return (await this.getAll()).map(user => ({
      ...user,
      featured: latestUsers.some(u => u.id === user.id),
      label: user.name ?? user.email,
    }))
  }

  static async create(email: string, password: string, name: string): Promise<PublicUser> {
    const created = await db
      .insert(users)
      .values({
        email,
        passwordHash: Buffer.from(await hash(password)),
        name,
      })
      .returning()

    const user = created.at(0)
    if (!user) throw new Error(`Failed to create user '${email}'`)
    return this.getDetails(user)
  }

  static generateShortName(name: string): string {
    if (name.includes(' ')) {
      const nameParts = name.split(' ')
      return (name.at(0) + nameParts[nameParts.length - 1]).toUpperCase()
    }
    return name.substring(0, 3).toUpperCase()
  }

  static getDetails(user: User): PublicUser {
    return {
      ...user,
      shortName: user.shortName ?? UserManager.generateShortName(user.name),
      passwordHash: undefined,
    }
  }
}
