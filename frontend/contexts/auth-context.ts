import type { LoginRequest } from '@common/models/auth'
import type { EventRes } from '@common/models/socket.io'
import type { UserInfo } from '@common/models/user'
import { createContext } from 'react'

export type AuthContextType = {
  isLoading: boolean
} & (
  | {
      isLoggedIn: false
      loggedInUser: undefined
      login: (request: Omit<LoginRequest, 'type'>) => Promise<EventRes<'login'>>
      logout: undefined
    }
  | {
      isLoggedIn: true
      loggedInUser: UserInfo
      login: undefined
      logout: () => void
    }
)

export const AuthContext = createContext<AuthContextType | null>(null)
