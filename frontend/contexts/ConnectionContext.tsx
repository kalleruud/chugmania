import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { io, Socket } from 'socket.io-client'
import type { BackendResponse } from '../../common/models/responses'
import { AUTH_KEY } from '../../common/utils/constants'

type ConnectionContextType = {
  socket: Socket
  isConnected: boolean
  refreshToken: typeof refreshToken
}

const socket = io('/', {
  auth: { token: localStorage.getItem(AUTH_KEY) },
})

function refreshToken(token: string | undefined): void {
  // @ts-expect-error
  socket.auth.token = token
  if (token) localStorage.setItem(AUTH_KEY, token)
  else localStorage.removeItem(AUTH_KEY)
  socket.disconnect().connect()
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(
  undefined
)

/**
 * Emits a socket event and returns a promise that resolves or rejects based on the response
 * @param socket - Socket.IO socket instance
 * @param event - Event name to emit
 * @param data - Data to send with the event
 * @returns Promise that resolves with the response or rejects with an error
 */
export function emitAsync<T extends BackendResponse>(
  socket: Socket,
  event: string,
  data?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.emit(event, data, (response: T) => {
      if (!response.success) {
        reject(
          new Error(
            (response as { message?: string }).message || 'Unknown error'
          )
        )
        return
      }
      resolve(response)
    })
  })
}

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
      console.error('Connection error:', err.message)
      setIsConnected(socket.connected)
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
      refreshToken,
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
