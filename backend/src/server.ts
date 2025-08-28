import { Server, Socket } from 'socket.io'
import ConnectionManager from './managers/connection.manager'

const port = 6996
const io = new Server(port, { cors: { origin: '*' } })

io.on('connection', onConnection)

async function onConnection(socket: Socket) {
  await ConnectionManager.connect(socket.id)
  socket.on('disconnect', () => {
    ConnectionManager.disconnect(socket.id)
  })
}

io.use((socket, next) => {
  console.debug(new Date().toISOString(), socket.id, 'Checking auth')

  const token = socket.handshake.auth.token
  if (token) return next()

  // console.debug(new Date().toISOString(), socket.id, 'Invalid token')
  // const err = {
  //   name: 'AuthenticationError',
  //   message: 'You must be logged in to see this content',
  // } satisfies ExtendedError

  // next(err)
  next()
})
