import loc from '@/lib/locales'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { io, Socket } from 'socket.io-client'
import { toast } from 'sonner'
import {
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '../../common/models/socket.io'
import { AUTH_KEY } from '../../common/utils/constants'

type ConnectionContextType = {
  socket: typeof socket
  isConnected: boolean
  setToken: typeof setToken
}

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io('/', {
  auth: { token: localStorage.getItem(AUTH_KEY) },
})

function setToken(token: string | undefined): void {
  // @ts-expect-error
  socket.auth.token = token
  if (token) localStorage.setItem(AUTH_KEY, token)
  else localStorage.removeItem(AUTH_KEY)
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(
  undefined
)

export function ConnectionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [isConnected, setIsConnected] = useState<
    ConnectionContextType['isConnected']
  >(socket.connected)

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
      console.error(loc.no.error.messages.connection_failed(err))
      setIsConnected(socket.connected)
      toast.error(loc.no.error.messages.connection_failed(err))
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
    }
  }, [])

  const context = useMemo<ConnectionContextType>(
    () => ({
      socket,
      isConnected,
      setToken,
    }),
    [socket, isConnected]
  )

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
