import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as schema from '../../database/schema'
import { sessions } from '../../database/schema'
import { getUnconfirmedRounds, ingestHeat } from './capture.store'

type Db = ReturnType<typeof drizzle<typeof schema>>

let db: Db
let sessionId: string

beforeEach(async () => {
  const sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: 'drizzle' })
  const [s] = await db
    .insert(sessions)
    .values({ name: 'Test', date: new Date() })
    .returning()
  sessionId = s.id
})

const payload = {
  contractVersion: 1,
  heatId: 'heat-1',
  mapUid: 'uid-1',
  mapName: 'Map One',
  playerCount: 2,
  results: [
    { slot: 1, bestTimeMs: 42300 },
    { slot: 2, bestTimeMs: 45100 },
  ],
}

test('ingestHeat creates a track and two laps, grouped into one round', async () => {
  await ingestHeat(db, payload, sessionId)
  const rounds = await getUnconfirmedRounds(db)
  assert.equal(rounds.length, 1)
  assert.equal(rounds[0].heatId, 'heat-1')
  assert.equal(rounds[0].playerCount, 2)
  assert.equal(rounds[0].laps.length, 2)
  const tracks = await db.select().from(schema.tracks)
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].mapUid, 'uid-1')
})

test('ingestHeat reuses an existing track for the same mapUid', async () => {
  await ingestHeat(db, payload, sessionId)
  await ingestHeat(db, { ...payload, heatId: 'heat-2' }, sessionId)
  const tracks = await db.select().from(schema.tracks)
  assert.equal(tracks.length, 1)
})

test('ingestHeat is idempotent on a duplicate heatId', async () => {
  await ingestHeat(db, payload, sessionId)
  await ingestHeat(db, payload, sessionId)
  const rounds = await getUnconfirmedRounds(db)
  assert.equal(rounds.length, 1)
  assert.equal(rounds[0].laps.length, 2)
})
