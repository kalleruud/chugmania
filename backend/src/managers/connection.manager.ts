import { Socket } from 'socket.io'

export default class ConnectionManager {
  static connect(socket: Socket) {
    console.debug(new Date().toISOString(), socket.id, '✅ Connected')

    socket.on('disconnect', () => {
      console.debug(new Date().toISOString(), socket.id, '🚫 Disconnected')
    })
  }
}
