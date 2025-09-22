import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { io, Socket } from 'socket.io-client'
import { AUTH_KEY } from '../../common/utils/constants'

type ConnectionContextType = {
  socket: Socket
  isConnected: boolean
  setToken: (token: string | undefined) => void
}

const socket = io('http://localhost:6997', {
  auth: { token: localStorage.getItem(AUTH_KEY) },
})

const setToken: ConnectionContextType['setToken'] = token => {
  // @ts-expect-error
  socket.auth.token = token
  if (!token) localStorage.removeItem(AUTH_KEY)
  else localStorage.setItem(AUTH_KEY, token)
  socket.connect()
}

const ConnectionContext = createContext<ConnectionContextType>({
  isConnected: socket.connected,
  socket: socket,
  setToken,
})

export function ConnectionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [isConnected, setIsConnected] = useState(socket.connected)
  const context = useMemo(
    () => ({ isConnected, socket, setToken }),
    [isConnected]
  )

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
