import type { ServerToClientEvents } from '@common/models/socket.io'
import type { TournamentDetails } from '@common/models/tournament'
import { Database } from 'bun:sqlite'
import { afterAll, mock } from 'bun:test'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import express from 'express'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { migrateDatabase } from '../backend/database/migrations'
import * as schema from '../backend/database/schema'
import type { TypedSocket } from '../backend/src/server'

process.env.SECRET = 'test-secret'
process.env.DATABASE_PATH = ':memory:'

const database = new Database(':memory:')
database.run('PRAGMA foreign_keys = ON')
export const db = drizzle(database, { schema })
migrateDatabase(database, () => migrate(db, { migrationsFolder: 'drizzle' }))

mock.module('../backend/database/database', () => ({ default: db, database }))
const { default: TournamentSecurity } =
  await import('../backend/src/managers/tournament/tournament.security')
export const tournamentSockets = new Set<TypedSocket>()
export const broadcastTournaments = mock(
  (details: TournamentDetails[], actor: string | null = null) => {
    for (const socket of tournamentSockets)
      TournamentSecurity.emit(socket, details, actor)
  }
)
export const broadcast = mock<
  (event: keyof ServerToClientEvents, ...args: unknown[]) => void
>(() => undefined)
mock.module('../backend/src/server', () => ({
  broadcast,
  broadcastTournaments,
}))

afterAll(() => database.close())

export async function startWebhookReceiver() {
  const { createWebhookRouter } = await import('../backend/src/webhook.router')
  const app = express()
  app.use(createWebhookRouter())
  const server = createServer(app)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return {
    url: `http://127.0.0.1:${address.port}/api/webhook`,
    close: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
      )
    },
  }
}
