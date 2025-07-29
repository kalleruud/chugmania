import { ExtendedError, Server } from 'socket.io'
import ConnectionManager from './managers/connection.manager.ts'

const port = 6996
const io = new Server(port, { cors: { origin: '*' } })

io.on('connection', socket => {
  ConnectionManager.connect(socket.id, 'ole')
  socket.on('disconnect', () => {
    ConnectionManager.disconnect(socket.id)
  })
})

io.use((socket, next) => {
  console.debug(new Date().toISOString(), socket.id, 'Checking auth')

  const token = socket.handshake.auth.token
  if (token) return next()

  const err = {
    name: 'AuthenticationError',
    message: 'You must be logged in to see this content.',
    data: {
      content: 'Hello World',
    },
  } satisfies ExtendedError

  next(err)
})
