import type { CsvTable } from '@common/models/importCsv'
import { eq } from 'drizzle-orm'
import db from '../database'
import * as tables from '../schema'
import TransactionSource from './transaction.source'

export default class AdminSource {
  private static readonly tables = { ...tables }
  private static table(name: CsvTable) {
    if (!Object.hasOwn(this.tables, name)) throw new Error('Unknown CSV table')
    return this.tables[name]
  }

  static getRows(name: CsvTable) {
    return db.select().from(this.table(name)).all()
  }

  static importRows(
    name: CsvTable,
    data: Record<string, unknown>[],
    reconcile: () => void
  ): { created: number; updated: number } {
    const table = this.table(name)
    const existingIds = new Set(
      db
        .select({ id: table.id })
        .from(table)
        .all()
        .map(row => row.id)
    )
    const toCreate: Record<string, unknown>[] = []
    const toUpdate: Record<string, unknown>[] = []
    for (const item of data) {
      if (typeof item.id === 'string' && existingIds.has(item.id)) {
        toUpdate.push(item)
      } else {
        const entry: Record<string, unknown> = { ...item }
        if (entry.createdAt === null) delete entry.createdAt
        toCreate.push(entry)
      }
    }
    return TransactionSource.run(() => {
      let created = 0
      let updated = 0
      if (toCreate.length)
        created = db.insert(table).values(toCreate).run().changes
      for (const item of toUpdate) {
        if (typeof item.id !== 'string') continue
        updated += db
          .update(table)
          .set(item)
          .where(eq(table.id, item.id))
          .run().changes
      }
      reconcile()
      return { created, updated }
    })
  }
}
