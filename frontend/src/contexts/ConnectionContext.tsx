// ConnectionContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { io, Socket } from 'socket.io-client'

type ConnectionContextType = {
  socket: Socket
  isConnected: boolean
}

const socket = io('http://localhost:6996', {
  autoConnect: false,
})

const ConnectionContext = createContext<ConnectionContextType>({
  isConnected: socket.connected,
  socket: socket,
})

export function ConnectionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [isConnected, setIsConnected] = useState(socket.connected)
  const context = useMemo(() => ({ isConnected, socket }), [isConnected])

  useEffect(() => {
    socket.connect()

    socket.on('connect', () => {
      console.log('Connected to backend:', socket.id)
      setIsConnected(socket.connected)
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from backend')
      setIsConnected(socket.connected)
    })

    socket.on('connect_error', err => {
      console.error('Connection error:', err.message)
      setIsConnected(socket.connected)
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
    }
  }, [])

  return (
    <ConnectionContext.Provider value={context}>
      {children}
    </ConnectionContext.Provider>
  )
}

export const useConnection = () => {
  const context = useContext(ConnectionContext)
  if (!context)
    throw new Error('useConnection must be used inside ConnectionProvider')
  return context
}
