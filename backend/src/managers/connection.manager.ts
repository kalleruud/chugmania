import tryCatch from '@chugmania/common/utils/try-catch.js'
import db from '@database/database'
import { connections } from '@database/schema'
import { eq } from 'drizzle-orm'

export default class ConnectionManager {
  static readonly table = connections

  static async connect(socketId: string, userId: string) {
    const { data, error } = await tryCatch(
      db
        .insert(this.table)
        .values({ socket: socketId, user: userId })
        .onConflictDoNothing({ target: this.table.socket })
        .onConflictDoUpdate({
          target: this.table.user,
          set: { socket: socketId },
        })
        .returning({ socket: this.table.socket })
    )

    if (error) {
      console.warn(
        new Date().toISOString(),
        socketId,
        'Failed to store connection:',
        error
      )
      return false
    }

    console.debug(
      new Date().toISOString(),
      socketId,
      'Stored connection:',
      data
    )
    return true
  }

  static async disconnect(socketId: typeof this.table.$inferSelect.socket) {
    const { data, error } = await tryCatch(
      db
        .delete(this.table)
        .where(eq(this.table.socket, socketId))
        .returning({ socket: this.table.socket })
    )

    if (error) {
      console.warn(
        new Date().toISOString(),
        socketId,
        'Failed to remove connection:',
        error
      )
      return false
    }

    if (data.length != 1) {
      console.warn(
        new Date().toISOString(),
        socketId,
        `Removed ${data.length} connections:`,
        data.map(d => d.socket)
      )
      return data.length > 0
    }

    console.debug(
      new Date().toISOString(),
      socketId,
      'Successfully removed connection'
    )
    return true
  }

  static async getConnections() {
    return await db.query.connections.findMany()
  }
}
