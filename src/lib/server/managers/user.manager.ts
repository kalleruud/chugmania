import db from '$lib/server/db'
import type { LookupEntity } from '@/components/lookup/lookup.server'
import { hash } from '@/utils'
import { randomUUID } from 'crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { sessions, timeEntries, users } from '../db/schema'
import SessionManager from './session.manager'

type User = typeof users.$inferSelect

export type Role = 'admin' | 'moderator' | 'user'
export type PublicUser = Omit<User, 'passwordHash'> & {
  shortName: string
  readableRole: string
  passwordHash: undefined
}

export default class UserManager {
  static readonly table = users

  static async init() {
    const result = await db.select().from(users)
    if (result.length > 0) return
    console.info('Initializing admin user')
    const password = randomUUID()
    console.info('password:', password)
    await this.create('admin@chugmania.no', password, 'Admin')
  }

  static isUser(user: unknown): user is PublicUser {
    if (!user) return false
    if (!(user instanceof Object)) return false
    return 'email' in user && 'name' in user
  }

  static async getUserById(id: string): Promise<PublicUser> {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) })
    if (!user) throw new Error(`User not found: ${id}`)
    return this.getDetails(user)
  }

  static async getUserByEmail(email: string): Promise<User | undefined> {
    return await db.query.users.findFirst({
      where: and(eq(users.email, email), isNull(users.deletedAt)),
    })
  }

  static async getAll(): Promise<PublicUser[]> {
    return (await db.select().from(users).where(isNull(users.deletedAt))).map(this.getDetails)
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

  static async create(
    email: string,
    password: string,
    name: string,
    role?: Role
  ): Promise<PublicUser> {
    const created = await db
      .insert(users)
      .values({
        email,
        passwordHash: Buffer.from(await hash(password)),
        name,
        role,
      })
      .returning()

    const user = created.at(0)
    if (!user) throw new Error(`Failed to create user '${email}'`)
    return this.getDetails(user)
  }

  static async update(data: FormData) {
    const id = data.get('id')!.toString()
    if (id?.length === 0) throw new Error('No user ID provided')
    console.debug('Updating user:', id)

    const email = data.get('email')!.toString().trim().toLowerCase()
    const name = data.get('name')!.toString().trim()
    const shortName = data.get('shortName')!.toString().toUpperCase().trim()
    const password = data.get('password')!.toString().trim()

    await db
      .update(users)
      .set({
        email: email.length > 0 ? email : undefined,
        name: name.length > 0 ? name : undefined,
        shortName: shortName.length > 0 ? shortName : undefined,
        passwordHash: password.length > 0 ? Buffer.from(await hash(password)) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
  }

  static async delete(data: FormData) {
    const id = data.get('id')?.toString().trim().toLowerCase()
    if (!id) throw new Error('No user ID provided')
    console.debug('Deleting user:', id)
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id))
  }

  static generateShortName(name: string): string {
    if (name.includes(' ')) {
      const nameParts = name.split(' ')
      return (name.at(0) + nameParts[nameParts.length - 1]).toUpperCase()
    }
    return name.substring(0, 3).toUpperCase()
  }

  static getReadableRole(role: Role): string {
    switch (role) {
      case 'admin':
        return 'Supreme World Champion'
      case 'moderator':
        return 'Minion'
      case 'user':
        return 'Casual penis enjoyer'
    }
  }

  static getDetails(user: User): PublicUser {
    return {
      ...user,
      readableRole: UserManager.getReadableRole(user.role),
      shortName: user.shortName ?? UserManager.generateShortName(user.name),
      passwordHash: undefined,
    }
  }
}
