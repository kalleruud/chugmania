import { integer, text } from 'drizzle-orm/sqlite-core'
import { randomUUID } from 'node:crypto'

export const common = {
  id: text().primaryKey().$defaultFn(randomUUID),
  updatedAt: integer({ mode: 'timestamp' }).$onUpdateFn(() => new Date()),
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer({ mode: 'timestamp' }),
}
