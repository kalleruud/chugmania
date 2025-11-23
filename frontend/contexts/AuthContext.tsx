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
import type { LoginRequest } from '../../common/models/requests'
import {
  type ErrorResponse,
  type LoginResponse,
} from '../../common/models/responses'
import { WS_BROADCAST_USER_DATA, type UserInfo } from '../../common/models/user'
import { WS_LOGIN_NAME } from '../../common/utils/constants'
import { emitAsync, useConnection } from './ConnectionContext'

type AuthContextType = {
  isLoggedIn: boolean
  isLoading: boolean
  user: UserInfo | undefined
  login: (request: LoginRequest) => void
  logout: () => void

  requiresEmailUpdate: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { socket, refreshToken: setToken } = useConnection()
  const [userInfo, setUserInfo] = useState<AuthContextType['user'] | undefined>(
    undefined
  )
  const [isLoading, setIsLoading] = useState(true)
  const [requiresEmailUpdate, setRequiresEmailUpdate] = useState(false)

  function handleResponse(response: ErrorResponse | LoginResponse) {
    try {
      if (!response.success) {
        console.error(response.message)
        return logout()
      }

      setUserInfo(response.userInfo)
      if (response.token) setToken(response.token)
      setRequiresEmailUpdate(
        response.userInfo.email.toLowerCase().endsWith('@chugmania.no')
      )
    } finally {
      setIsLoading(false)
    }
  }

  const login: AuthContextType['login'] = r => {
    setIsLoading(true)
    toast.promise(
      emitAsync(socket, WS_LOGIN_NAME, r, handleResponse),
      loc.no.user.login.request
    )
  }

  const logout = () => {
    setToken(undefined)
    setUserInfo(undefined)
    setRequiresEmailUpdate(false)
  }

  useEffect(() => {
    socket.on(WS_BROADCAST_USER_DATA, (r: LoginResponse) => {
      try {
        if (!r.success) return
        setUserInfo(r.userInfo)
        setRequiresEmailUpdate(
          r.userInfo.email.toLowerCase().endsWith('@chugmania.no')
        )
      } finally {
        setIsLoading(false)
      }
    })
    return () => {
      socket.off(WS_BROADCAST_USER_DATA)
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
