import { ErrorResponse } from '../../../common/models/responses'
import {
  ClientToServerEvents,
  EventReq,
  EventRes,
} from '../../../common/models/socket.io'
import { TypedSocket } from '../server'

export function bind(
  socket: TypedSocket,
  handlers: {
    [Ev in keyof ClientToServerEvents]?: (
      s: TypedSocket,
      req: EventReq<Ev>
    ) => Promise<EventRes<Ev>>
  }
) {
  for (const [event, handler] of Object.entries(handlers) as [
    keyof ClientToServerEvents,
    (
      s: TypedSocket,
      req: EventReq<keyof ClientToServerEvents>
    ) => Promise<EventRes<keyof ClientToServerEvents>>,
  ][]) {
    if (!handler) continue
    setup(socket, event, handler)
  }
}

async function setup<Ev extends keyof ClientToServerEvents>(
  s: TypedSocket,
  event: Ev,
  handler: (s: TypedSocket, r: EventReq<Ev>) => Promise<EventRes<Ev>>
) {
  s.on(
    event,
    // @ts-expect-error
    async (r: EventReq<Ev>, callback: EventCb<Ev>) =>
      handler(s, r)
        .catch(err =>
          callback({
            success: false,
            message: err.message,
          } satisfies ErrorResponse)
        )
        .then(callback)
  )
}
