import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { generateTracks } from './data'
import { sessions, tracks, users } from './schema'
import jwt from 'jsonwebtoken'

const db = drizzle(new Database('local.db'))

// Seed the database with tracks if it's empty
db.select()
  .from(tracks)
  .then(result => {
    if (result.length > 0) return
    console.info('Adding tracks to the database')
    db.insert(tracks)
      .values(generateTracks())
      .then(() => {
        console.info('Tracks added successfully')
      })
  })

const privateKey = crypto.getRandomValues(new Uint8Array(32)).toString()
const jwtOptions: jwt.SignOptions = {
  issuer: 'https://kallerud.no',
  algorithm: 'HS256',
  expiresIn: '7d',
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, privateKey, jwtOptions) as typeof users.$inferSelect
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError)) throw error
    console.error('Failed to verify token:', error.message)
    return
  }
}

export async function getSessions() {
  console.debug('Getting sessions')
  return await db.select().from(sessions).orderBy(sessions.date).limit(10)
}

export async function createSession(session: typeof sessions.$inferInsert) {
  console.debug('Creating session')
  return await db.insert(sessions).values(session).returning()
}

async function findUser(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email))

  if (result.length === 0) {
    console.warn('User not found for email:', email)
    return
  }

  return result.at(0)
}

export async function userExists(email: string) {
  const user = await findUser(email)
  return !!user
}

export async function login(email: string, password: string) {
  const user = await findUser(email)
  const passwordHash = await hash(password)

  if (!user?.passwordHash.equals(Buffer.from(passwordHash))) {
    console.warn('Invalid password for user:', email)
    return
  }

  const token = jwt.sign(user, privateKey, jwtOptions)

  console.info('Logged in:', email)
  return token
}

export async function register(email: string, password: string, name: string) {
  const created = await db
    .insert(users)
    .values({
      email,
      passwordHash: Buffer.from(await hash(password)),
      name,
    })
    .returning()

  const user = created.at(0)

  if (!user) {
    console.error('Failed to create user:', email)
    throw new Error(`Failed to create user '${email}'`)
  }

  return user
}

export async function hash(value: string) {
  return await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
}
