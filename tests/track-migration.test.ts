import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'

test('track metadata migration preserves references and separates environments from map types', () => {
  const database = new Database(':memory:')
  try {
    database.run('PRAGMA foreign_keys = OFF')
    for (const file of readdirSync('drizzle').sort()) {
      if (file.endsWith('.sql') && file < '0014')
        database.run(readFileSync(`drizzle/${file}`, 'utf8'))
    }
    database.run(`
      INSERT INTO tracks (id, created_at, number, level, type) VALUES
        ('canyon', 1, 1, 'white', 'drift'),
        ('valley', 1, 42, 'green', 'valley'),
        ('lagoon', 1, 123, 'blue', 'lagoon'),
        ('stadium', 1, 200, 'black', 'stadium');
      INSERT INTO users (id, created_at, email, first_name, password_hash, role)
        VALUES ('migration-user', 1, 'migration@example.test', 'Migration', 'hash', 'user');
      INSERT INTO time_entries (id, created_at, user, track)
        VALUES ('migration-entry', 1, 'migration-user', 'canyon');
      INSERT INTO matches (id, created_at, track, status)
        VALUES ('migration-match', 1, 'valley', 'pending');
    `)
    database.run('PRAGMA foreign_keys = OFF')
    database.transaction(() => {
      database.run(readFileSync('drizzle/0014_track_metadata.sql', 'utf8'))
    })()
    database.run('PRAGMA foreign_keys = ON')
    expect(
      database
        .query(
          'SELECT name, level, environment, map_type, game FROM tracks ORDER BY name'
        )
        .all()
    ).toEqual([
      {
        name: '001',
        level: 'white',
        environment: 'Canyon',
        map_type: null,
        game: 'turbo',
      },
      {
        name: '042',
        level: 'green',
        environment: 'Valley',
        map_type: null,
        game: 'turbo',
      },
      {
        name: '123',
        level: 'blue',
        environment: 'Lagoon',
        map_type: null,
        game: 'turbo',
      },
      {
        name: '200',
        level: 'black',
        environment: 'Stadium',
        map_type: null,
        game: 'turbo',
      },
    ])
    expect(database.query('SELECT track FROM time_entries').get()).toEqual({
      track: 'canyon',
    })
    expect(database.query('SELECT track FROM matches').get()).toEqual({
      track: 'valley',
    })
    expect(database.query('PRAGMA foreign_key_check').all()).toEqual([])
    database.run(
      "INSERT INTO tracks (id, created_at, name, game) VALUES ('unknown', 1, 'Unknown map', 'next')"
    )
    expect(
      database
        .query(
          "SELECT level, environment, map_type FROM tracks WHERE id = 'unknown'"
        )
        .get()
    ).toEqual({ level: null, environment: null, map_type: null })
  } finally {
    database.close()
  }
})
