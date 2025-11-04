import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type {
  LoginRequest,
  RegisterRequest,
} from '../../common/models/requests'
import {
  type ErrorResponse,
  type LoginResponse,
} from '../../common/models/responses'
import { type UserInfo } from '../../common/models/user'
import {
  AUTH_KEY,
  WS_GET_USER_DATA,
  WS_LOGIN_NAME,
  WS_REGISTER_NAME,
} from '../../common/utils/constants'
import { emitAsync, useConnection } from './ConnectionContext'

type AuthContextType = {
  isLoggedIn: boolean
  isLoading: boolean
  user: UserInfo | undefined
  login: (request: LoginRequest) => void
  register: (request: RegisterRequest) => void
  logout: () => void
  refreshUser: (user: UserInfo, token?: string) => void
  requiresEmailUpdate: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { socket, refreshToken: setToken } = useConnection()
  const navigate = useNavigate()
  const [userInfo, setUserInfo] = useState<AuthContextType['user'] | undefined>(
    undefined
  )
  const [isLoading, setIsLoading] = useState(false)
  const [requiresEmailUpdate, setRequiresEmailUpdate] = useState(false)

  const refreshUser: AuthContextType['refreshUser'] = useCallback(
    (user, token) => {
      setUserInfo(user)
      if (token) setToken(token)
      setRequiresEmailUpdate(user.email.toLowerCase().endsWith('@chugmania.no'))
    },
    [setToken]
  )

  function handleResponse(response: ErrorResponse | LoginResponse) {
    try {
      if (!response.success) {
        console.error(response.message)
        return logout()
      }

      refreshUser(response.userInfo, response.token)
    } finally {
      setIsLoading(false)
    }
  }

  const login: AuthContextType['login'] = r => {
    setIsLoading(true)
    toast.promise(emitAsync(socket, WS_LOGIN_NAME, r, handleResponse), {
      loading: 'Logger inn...',
      success: 'Logget inn!',
      error: e => `Innlogging feilet: ${e.message}`,
    })
  }

  const register: AuthContextType['register'] = r => {
    setIsLoading(true)
    socket.emit(WS_REGISTER_NAME, r, handleResponse)
  }

  const logout = () => {
    setToken(undefined)
    setUserInfo(undefined)
    setRequiresEmailUpdate(false)
    navigate('/login')
  }

  useEffect(() => {
    if (!userInfo && localStorage.getItem(AUTH_KEY)) {
      setIsLoading(true)

      toast.promise(
        emitAsync(socket, WS_GET_USER_DATA, undefined, handleResponse),
        {
          loading: 'Logger inn...',
          success: 'Logget inn!',
          error: e => `Innlogging feilet: ${e.message}`,
        }
      )
    }
  }, [socket])

  const context = useMemo<AuthContextType>(
    () => ({
      isLoggedIn: !!userInfo,
      isLoading,
      user: userInfo,
      login,
      register,
      logout,
      refreshUser,
      requiresEmailUpdate,
    }),
    [userInfo, requiresEmailUpdate, refreshUser]
  )

  return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
