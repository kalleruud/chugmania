import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as schema from '../../database/schema'
import { matches, sessions, timeEntries, users } from '../../database/schema'
import { confirmCapture, discardCapture, getUnconfirmedRounds, ingestHeat } from './capture.store'

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

async function makeUser(db: Db, name: string): Promise<string> {
  const [u] = await db
    .insert(users)
    .values({
      email: `${name}@x.no`,
      firstName: name,
      passwordHash: Buffer.from('x'),
    })
    .returning()
  return u.id
}

test('confirmCapture writes two auto time entries + a completed match, deletes laps', async () => {
  await ingestHeat(db, payload, sessionId)
  const a = await makeUser(db, 'alice')
  const b = await makeUser(db, 'bob')

  await confirmCapture(db, 'heat-1', [
    { slot: 1, user: a },
    { slot: 2, user: b },
  ])

  const entries = await db.select().from(timeEntries)
  assert.equal(entries.length, 2)
  assert.equal(entries.every(e => e.source === 'auto'), true)
  assert.equal(entries.every(e => e.session === sessionId), true)

  const [match] = await db.select().from(matches)
  assert.equal(match.status, 'completed')
  assert.equal(match.winner, a) // slot 1 was faster (42300 < 45100)

  const rounds = await getUnconfirmedRounds(db)
  assert.equal(rounds.length, 0)
})

test('confirmCapture for a solo round writes one entry and no match', async () => {
  await ingestHeat(
    db,
    {
      ...payload,
      heatId: 'solo-1',
      playerCount: 1,
      results: [{ slot: 1, bestTimeMs: 40000 }],
    },
    sessionId
  )
  const a = await makeUser(db, 'solo')
  await confirmCapture(db, 'solo-1', [{ slot: 1, user: a }])
  assert.equal((await db.select().from(timeEntries)).length, 1)
  assert.equal((await db.select().from(matches)).length, 0)
})

test('discardCapture removes laps without writing entries', async () => {
  await ingestHeat(db, payload, sessionId)
  await discardCapture(db, 'heat-1')
  assert.equal((await getUnconfirmedRounds(db)).length, 0)
  assert.equal((await db.select().from(timeEntries)).length, 0)
})
