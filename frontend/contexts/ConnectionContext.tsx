import loc from '@common/locale/locales'
import {
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@common/models/socket.io'
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

const AUTH_KEY = 'auth'

type ConnectionContextType = {
  socket: typeof socket
  isConnected: boolean
  allowSignups: boolean
  setToken: typeof setToken
}

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io('/', {
  autoConnect: false,
  auth: { token: localStorage.getItem(AUTH_KEY) },
}).timeout(10_000)

function setToken(token: string | undefined): void {
  socket.auth = { token }
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

  const [allowSignups, setAllowSignups] = useState(false)

  useEffect(() => {
    socket.on('registration_available', setAllowSignups)
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

    socket.connect()

    return () => {
      socket.off('registration_available', setAllowSignups)
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.disconnect()
    }
  }, [])

  const context = useMemo<ConnectionContextType>(
    () => ({
      socket,
      isConnected,
      allowSignups,
      setToken,
    }),
    [socket, isConnected, allowSignups]
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
