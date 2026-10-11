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

function withLegacyDatabase(
  beforeMigration: number,
  scenario: (sqlite: Database, upgrade: () => void) => void
) {
  const folder = mkdtempSync(path.join(tmpdir(), 'chugmania-migration-'))
  const sqlite = new Database(':memory:')
  try {
    mkdirSync(path.join(folder, 'meta'))
    const legacy = {
      ...journal,
      entries: journal.entries.filter(entry => entry.idx < beforeMigration),
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
    scenario(sqlite, () => {
      migrateDatabase(sqlite, () =>
        migrate(db, { migrationsFolder: 'drizzle' })
      )
    })
  } finally {
    sqlite.close()
    rmSync(folder, { recursive: true, force: true })
  }
}

test('Webhook migration preserves legacy results and their track references', () => {
  withLegacyDatabase(14, (sqlite, upgrade) => {
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
    upgrade()
    expect(
      sqlite.query('SELECT name, level, type, game, uid FROM tracks').get()
    ).toEqual({
      name: '012',
      level: 'white',
      type: 'stadium',
      game: 'turbo',
      uid: null,
    })
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
  })
})

test('Track migration replaces numbers and map types and preserves game metadata and references', () => {
  withLegacyDatabase(15, (sqlite, upgrade) => {
    sqlite.run(
      "INSERT INTO sessions (id, created_at, name, date, status) VALUES ('session', 0, 'Migration', 0, 'confirmed')"
    )
    sqlite.run(
      "INSERT INTO tracks (id, created_at, number, name, level, type, map_type, uid, gold_medal_ms) VALUES ('numbered', 0, 7, 'Previous metadata name', 'white', 'stadium', NULL, NULL, NULL), ('named', 0, NULL, 'Next map', 'custom', NULL, 'TrackMania\\TM_Race', 'next-uid', 41000), ('empty', 0, NULL, NULL, 'custom', NULL, NULL, NULL, NULL)"
    )
    sqlite.run(
      "INSERT INTO webhook_captures (id, created_at, game_id, session, total_players, source_game, plugin_name, plugin_version) VALUES ('capture', 0, 'capture', 'session', 1, 'next', 'test', '1.0.0')"
    )
    sqlite.run(
      "INSERT INTO time_entries (id, created_at, track, session, publication_state, webhook_capture) VALUES ('draft', 0, 'named', 'session', 'draft', 'capture')"
    )
    sqlite.run(
      "INSERT INTO tracks (id, created_at, name, level, type) VALUES ('match-map', 0, 'Next match map', 'custom', 'Race')"
    )
    sqlite.run(
      "INSERT INTO matches (id, created_at, track, session, status, publication_state, webhook_capture) VALUES ('match', 0, 'match-map', 'session', 'planned', 'draft', 'capture')"
    )
    sqlite.run('PRAGMA foreign_keys = ON')
    upgrade()
    expect(
      sqlite.query('SELECT id, name, type, game FROM tracks ORDER BY id').all()
    ).toEqual([
      { id: 'empty', name: 'Unnamed track', type: 'unknown', game: 'turbo' },
      { id: 'match-map', name: 'Next match map', type: 'Race', game: 'next' },
      {
        id: 'named',
        name: 'Next map',
        type: 'TrackMania\\TM_Race',
        game: 'next',
      },
      { id: 'numbered', name: '007', type: 'stadium', game: 'turbo' },
    ])
    expect(
      sqlite
        .query('SELECT uid, gold_medal_ms FROM tracks WHERE id = ?')
        .get('named')
    ).toEqual({ uid: 'next-uid', gold_medal_ms: 41000 })
    const columns = sqlite
      .query<{ name: string }, []>('PRAGMA table_info(tracks)')
      .all()
      .map(c => c.name)
    expect(columns).not.toContain('number')
    expect(columns).not.toContain('map_type')
    expect(
      sqlite.query('SELECT track FROM time_entries WHERE id = ?').get('draft')
    ).toEqual({ track: 'named' })
    expect(sqlite.query('PRAGMA foreign_key_check').all()).toEqual([])
    expect(() =>
      sqlite.run(
        "INSERT INTO tracks (id, created_at, level, type, game) VALUES ('invalid', 0, 'custom', 'race', 'next')"
      )
    ).toThrow()
    expect(() =>
      sqlite.run(
        "INSERT INTO tracks (id, created_at, level, name, game) VALUES ('invalid', 0, 'custom', 'Name', 'next')"
      )
    ).toThrow()
    expect(() =>
      sqlite.run(
        "INSERT INTO tracks (id, created_at, level, name, type) VALUES ('invalid', 0, 'custom', 'Name', 'race')"
      )
    ).toThrow()
  })
})

test('Track name migration pads previously migrated numeric names without truncating or changing map names', () => {
  withLegacyDatabase(17, (sqlite, upgrade) => {
    sqlite.run(
      "INSERT INTO tracks (id, created_at, name, level, type, game) VALUES ('one', 0, '7', 'white', 'stadium', 'turbo'), ('two', 0, '42', 'green', 'stadium', 'turbo'), ('three', 0, '123', 'blue', 'stadium', 'turbo'), ('four', 0, '1000', 'custom', 'race', 'next'), ('padded', 0, '004', 'white', 'stadium', 'turbo'), ('named', 0, 'Next map 7', 'custom', 'race', 'next')"
    )
    upgrade()
    expect(
      sqlite.query('SELECT id, name FROM tracks ORDER BY id').all()
    ).toEqual([
      { id: 'four', name: '1000' },
      { id: 'named', name: 'Next map 7' },
      { id: 'one', name: '007' },
      { id: 'padded', name: '004' },
      { id: 'three', name: '123' },
      { id: 'two', name: '042' },
    ])
    expect(sqlite.query('PRAGMA foreign_key_check').all()).toEqual([])
  })
})
