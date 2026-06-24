import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@common/models/socket.io'
import type { Socket } from 'socket.io'

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

type ProtectedServerEvent = Exclude<keyof ServerToClientEvents, 'user_data'>

const sockets = new Set<TypedSocket>()

export function trackSocket(socket: TypedSocket): void {
  sockets.add(socket)
  socket.on('disconnect', () => sockets.delete(socket))
}

export function broadcast<Ev extends ProtectedServerEvent>(
  ev: Ev,
  ...args: Parameters<ServerToClientEvents[Ev]>
): void {
  sockets.forEach(socket => {
    if (socket.data.userId) {
      socket.emit(ev, ...args)
    }
  })
}
