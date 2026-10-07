import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { migrateDatabase } from '../backend/database/migrations'
import journal from '../drizzle/meta/_journal.json'

test('Webhook migration preserves legacy results and their track references', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'chugmania-migration-'))
  const sqlite = new Database(':memory:')
  try {
    mkdirSync(path.join(folder, 'meta'))
    const legacy = {
      ...journal,
      entries: journal.entries.filter(entry => entry.idx < 14),
    }
    writeFileSync(
      path.join(folder, 'meta/_journal.json'),
      JSON.stringify(legacy)
    )
    for (const entry of legacy.entries)
      copyFileSync(
        path.join('drizzle', `${entry.tag}.sql`),
        path.join(folder, `${entry.tag}.sql`)
      )
    const db = drizzle(sqlite)
    migrate(db, { migrationsFolder: folder })
    sqlite.run(
      "INSERT INTO users (id, created_at, email, first_name, password_hash, role) VALUES ('migration-user', 0, 'migration@example.test', 'Migration', X'00', 'user')"
    )
    sqlite.run(
      "INSERT INTO tracks (id, created_at, number, level, type) VALUES ('migration-track', 0, 12, 'white', 'stadium')"
    )
    sqlite.run(
      "INSERT INTO sessions (id, created_at, name, date, status) VALUES ('migration-session', 0, 'Legacy session', 0, 'confirmed')"
    )
    sqlite.run(
      "INSERT INTO time_entries (id, created_at, user, track, session, duration_ms, status) VALUES ('migration-lap', 0, 'migration-user', 'migration-track', 'migration-session', 12000, 'completed')"
    )
    sqlite.run(
      "INSERT INTO matches (id, created_at, user1, track, session, winner, duration_ms, status) VALUES ('migration-match', 0, 'migration-user', 'migration-track', 'migration-session', 'migration-user', 13000, 'completed')"
    )
    sqlite.run('PRAGMA foreign_keys = ON')
    migrateDatabase(sqlite, () => migrate(db, { migrationsFolder: 'drizzle' }))
    expect(
      sqlite.query('SELECT number, level, type, uid FROM tracks').get()
    ).toEqual({ number: 12, level: 'white', type: 'stadium', uid: null })
    expect(
      sqlite
        .query(
          'SELECT track, duration_ms, publication_state, webhook_capture FROM time_entries'
        )
        .get()
    ).toEqual({
      track: 'migration-track',
      duration_ms: 12000,
      publication_state: 'published',
      webhook_capture: null,
    })
    expect(
      sqlite
        .query('SELECT track, duration_ms, publication_state FROM matches')
        .get()
    ).toEqual({
      track: 'migration-track',
      duration_ms: 13000,
      publication_state: 'published',
    })
    expect(sqlite.query('PRAGMA foreign_key_check').all()).toEqual([])
    expect(sqlite.query('PRAGMA foreign_keys').get()).toEqual({
      foreign_keys: 1,
    })
  } finally {
    sqlite.close()
    rmSync(folder, { recursive: true, force: true })
  }
})
