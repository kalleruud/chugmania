import type { TournamentDetails } from '@common/models/tournament'
import { Database } from 'bun:sqlite'
import { afterAll, mock } from 'bun:test'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from '../backend/database/schema'
import type { TypedSocket } from '../backend/src/server'

process.env.SECRET = 'test-secret'
process.env.DATABASE_PATH = ':memory:'

const database = new Database(':memory:')
database.run('PRAGMA foreign_keys = ON')
export const db = drizzle(database, { schema })
migrate(db, { migrationsFolder: 'drizzle' })

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
mock.module('../backend/src/server', () => ({
  broadcast: mock(),
  broadcastTournaments,
}))

afterAll(() => database.close())
