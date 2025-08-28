import { Server } from 'socket.io'
import AuthManager from './managers/auth.manager'
import ConnectionManager from './managers/connection.manager'

const port = 6996
const io = new Server(port, { cors: { origin: '*' } })

io.on('connection', ConnectionManager.connect)

io.use((socket, next) => {
  AuthManager.checkAuth(socket)
    .catch(err => next(err))
    .then(() => next())
})
