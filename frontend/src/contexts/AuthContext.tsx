import {
  AUTH_KEY,
  WS_LOGIN_NAME,
  WS_REGISTER_NAME,
} from '@chugmania/common/models/constants.ts'
import type {
  LoginRequest,
  RegisterRequest,
} from '@chugmania/common/models/requests.js'
import {
  isErrorResponse,
  isLoginSuccessResponse,
  isRegisterSuccessResponse,
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
  errorMessage: string | undefined
  login: (request: LoginRequest) => void
  register: (request: RegisterRequest) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { socket } = useConnection()
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
  )
  const [token, setToken] = useState<string | null>(
    localStorage.getItem(AUTH_KEY)
  )

  function handleResponse(response: unknown) {
    if (isErrorResponse(response)) {
      console.error(response.message)
      return setErrorMessage(response.message)
    }

    if (isLoginSuccessResponse(response)) {
      setErrorMessage('')
      setToken(response.token)
      return localStorage.setItem(AUTH_KEY, response.token)
    }

    if (isRegisterSuccessResponse(response)) {
      setErrorMessage('')
      setToken(response.token)
      return localStorage.setItem(AUTH_KEY, response.token)
    }
    
    throw new Error('Shit went bad')
  }

  const login: AuthContextType['login'] = r => {
    socket.emit(WS_LOGIN_NAME, r, handleResponse)
  }

  const register: AuthContextType['register'] = r => {
    socket.emit(WS_REGISTER_NAME, r, handleResponse)
  }

  const logout = () => {
    socket.emit('logout')
    localStorage.removeItem(AUTH_KEY)
    setToken(null)
  }

  const context = useMemo(
    () =>
      ({
        isLoggedIn: !!token,
        errorMessage,
        token,
        login,
        register,
        logout,
      }) satisfies AuthContextType,
    [token, errorMessage]
  )

  return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
