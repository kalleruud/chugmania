import { AUTH_KEY, WS_LOGIN_NAME } from '@chugmania/common/models/constants.ts'
import type { LoginRequest } from '@chugmania/common/models/requests.js'
import {
  isErrorResponse,
  isLoginSuccessResponse,
} from '@chugmania/common/models/responses.js'
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useConnection } from './ConnectionContext'

type AuthContextType = {
  isLoggedIn: boolean
  token: string | null
  login: (email: string, password: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { socket } = useConnection()
  const [token, setToken] = useState<string | null>(
    localStorage.getItem(AUTH_KEY)
  )

  function handleLoginResponse(response: any) {
    if (isErrorResponse(response)) return console.error(response.message)
    if (isLoginSuccessResponse(response)) {
      setToken(response.token)
      localStorage.setItem(AUTH_KEY, response.token)
    }
  }

  const login = (email: string, password: string) => {
    console.log('Logging in with:', { email, password })
    socket.emit(
      WS_LOGIN_NAME,
      { email, password } satisfies LoginRequest,
      handleLoginResponse
    )
  }

  const logout = () => {
    socket.emit('logout')
    localStorage.removeItem(AUTH_KEY)
    setToken(null)
  }

  const context = useMemo(
    () => ({ isLoggedIn: !!token, token, login, logout }),
    [token]
  )

  return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
