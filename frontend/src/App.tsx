import { io } from 'socket.io-client'
import Login from './components/Login'

const socket = io('localhost:6996', {
  transports: ['websocket'],
})

function App() {
  return <Login />
}

export default App
