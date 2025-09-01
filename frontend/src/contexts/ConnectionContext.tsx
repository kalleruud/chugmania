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

const DEFAULT_BACKEND_PORT = 6996
const backendURL =
  (import.meta as any).env?.VITE_BACKEND_URL ??
  `${window.location.protocol}//${window.location.hostname}:${DEFAULT_BACKEND_PORT}`

const socket = io(backendURL)

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
    socket.on('connect', () => {
      console.log('Connected to backend:', socket.id)
      setIsConnected(socket.connected)
    })

    socket.on('disconnect', () => {
      console.warn('Disconnected from backend')
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
