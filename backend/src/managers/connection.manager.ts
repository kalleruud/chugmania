import { Socket } from 'socket.io'

export default class ConnectionManager {
  static async connect(socket: Socket) {
    console.debug(new Date().toISOString(), socket.id, '✅ Connected')
  }

  static async disconnect(socket: Socket) {
    console.debug(new Date().toISOString(), socket.id, '🚫 Disconnected')
  }
}
