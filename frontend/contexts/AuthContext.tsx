import loc from '@/lib/locales'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import type { LoginRequest } from '../../common/models/auth'
import { type ErrorResponse } from '../../common/models/responses'
import { type UserDataResponse, type UserInfo } from '../../common/models/user'
import { useConnection } from './ConnectionContext'

type AuthContextType = {
  isLoggedIn: boolean
  isLoading: boolean
  user: UserInfo | undefined
  login: (request: Omit<LoginRequest, 'type'>) => void
  logout: () => void

  requiresEmailUpdate: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { socket, setToken } = useConnection()
  const [userInfo, setUserInfo] = useState<AuthContextType['user'] | undefined>(
    undefined
  )
  const [isLoading, setIsLoading] = useState(true)
  const [requiresEmailUpdate, setRequiresEmailUpdate] = useState(false)

  function handleResponse(
    response: UserDataResponse | ErrorResponse,
    reconnect: boolean = true
  ) {
    try {
      if (!response.success) {
        console.warn(response.message)
        return logout()
      }

      setUserInfo(response.userInfo)
      setToken(response.token)
      setRequiresEmailUpdate(
        response.userInfo.email.toLowerCase().endsWith('@chugmania.no')
      )
      if (reconnect) socket.disconnect().connect()
    } finally {
      setIsLoading(false)
    }
  }

  const login: AuthContextType['login'] = r => {
    setIsLoading(true)
    toast.promise(
      socket
        .emitWithAck('login', { type: 'LoginRequest', ...r })
        .then(handleResponse),
      loc.no.user.login.request
    )
  }

  const logout = () => {
    setToken(undefined)
    setUserInfo(undefined)
    setRequiresEmailUpdate(false)
  }

  useEffect(() => {
    socket.on('user_data', r => handleResponse(r, false))
    return () => {
      socket.off('user_data')
    }
  }, [])

  const context = useMemo<AuthContextType>(
    () => ({
      isLoggedIn: !!userInfo,
      isLoading,
      user: userInfo,
      login,
      logout,
      requiresEmailUpdate,
    }),
    [userInfo, requiresEmailUpdate, isLoading]
  )

  return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
