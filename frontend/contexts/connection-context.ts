import {
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@common/models/socket.io'
import { createContext } from 'react'
import type { Socket } from 'socket.io-client'

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export type ConnectionContextType = {
  socket: AppSocket
  isConnected: boolean
  setToken: (token: string | undefined) => void
}

export const ConnectionContext = createContext<
  ConnectionContextType | undefined
>(undefined)
