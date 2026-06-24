import loc from '@/lib/locales'
import { useEffect, useState, type ReactNode } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'sonner'
import {
  ConnectionContext,
  type AppSocket,
  type ConnectionContextType,
} from './connection-context'

const AUTH_KEY = 'auth'

const socket: AppSocket = io('/', {
  auth: { token: localStorage.getItem(AUTH_KEY) },
}).timeout(10_000)

function setToken(token: string | undefined): void {
  if (typeof socket.auth === 'function') return
  socket.auth = { ...socket.auth, token }
  if (token) localStorage.setItem(AUTH_KEY, token)
  else localStorage.removeItem(AUTH_KEY)
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

  const context: ConnectionContextType = {
    socket,
    isConnected,
    setToken,
  }

  return (
    <ConnectionContext.Provider value={context}>
      {children}
    </ConnectionContext.Provider>
  )
}
