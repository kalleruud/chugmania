import type { TrackLevel, TrackType } from '@database/schema'
import * as schema from '@database/schema'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

const DB_URL = process.env.DB_URL
if (!DB_URL) throw Error("Missing environment varible 'DB_URL'")

const database = new Database(DB_URL)
database.pragma('journal_mode = WAL')

const db = drizzle(database, { schema })
export default db

db.query.tracks.findFirst().then(track => {
  if (track) return
  const trackCount = 200
  const items: (typeof schema.tracks.$inferInsert)[] = []

  const levels: TrackLevel[] = ['white', 'green', 'blue', 'red', 'black']
  const types: TrackType[] = ['drift', 'valley', 'lagoon', 'stadium']

  for (let i = 0; i < trackCount; i++) {
    items.push({
      number: i + 1,
      level: levels[Math.floor(i / 40) % levels.length]!,
      type: types[Math.floor(i / 10) % types.length]!,
    })
  }

  db.insert(schema.tracks)
    .values(items)
    .then(() => {
      console.log(`Inserted ${trackCount} tracks`)
    })
})
