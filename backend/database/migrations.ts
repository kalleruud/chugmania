export function migrateDatabase(
  database: { exec(sql: string): unknown },
  migrate: () => void
): void {
  database.exec('PRAGMA foreign_keys = OFF')
  try {
    migrate()
  } finally {
    database.exec('PRAGMA foreign_keys = ON')
  }
}
