import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import assert from 'node:assert/strict'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

test('clean migration and upgrade through tournament removal preserve ordinary data', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'tournament-migration-'))
  try {
    for (const upgrade of [false, true]) {
      const database = new Database(path.join(folder, `${upgrade}.sqlite`))
      try {
        const db = drizzle(database)
        if (upgrade) {
          const old = path.join(folder, 'original')
          mkdirSync(path.join(old, 'meta'), { recursive: true })
          const journal: unknown = JSON.parse(
            readFileSync('drizzle/meta/_journal.json', 'utf8')
          )
          assert.ok(
            journal &&
              typeof journal === 'object' &&
              'entries' in journal &&
              Array.isArray(journal.entries)
          )
          const entries: unknown[] = journal.entries
          writeFileSync(
            path.join(old, 'meta/_journal.json'),
            JSON.stringify({ ...journal, entries: entries.slice(0, 10) })
          )
          for (const file of readdirSync('drizzle').filter(file =>
            file.endsWith('.sql')
          ))
            copyFileSync(path.join('drizzle', file), path.join(old, file))
          migrate(db, { migrationsFolder: old })
          database
            .prepare(
              "INSERT INTO sessions (id, name, created_at, date, status) VALUES (?, ?, ?, 1, 'confirmed')"
            )
            .run('retained', 'Retained session', 1)
        }
        migrate(db, { migrationsFolder: 'drizzle' })
        if (upgrade)
          assert.ok(
            database
              .prepare('SELECT id FROM sessions WHERE id = ?')
              .get('retained')
          )
        else
          database
            .prepare(
              "INSERT INTO sessions (id, name, created_at, date, status) VALUES (?, ?, ?, 1, 'confirmed')"
            )
            .run('retained', 'Retained session', 1)
        const insert = database.prepare(
          'INSERT INTO tournaments (id, session, config, created_at) VALUES (?, ?, ?, ?)'
        )
        insert.run('one', 'retained', '{}', 1)
        assert.throws(() => insert.run('two', 'retained', '{}', 1), /UNIQUE/)
        database
          .prepare('UPDATE tournaments SET deleted_at = 2 WHERE id = ?')
          .run('one')
        insert.run('two', 'retained', '{}', 1)
      } finally {
        database.close()
      }
    }
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})
