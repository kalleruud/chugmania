import {
  AUTH_KEY,
  WS_LOGIN_NAME,
  WS_REGISTER_NAME,
} from '@chugmania/common/models/constants.ts'
import { WS_WHOAMI } from '@chugmania/common/models/constants.ts'
import type {
  LoginRequest,
  RegisterRequest,
} from '@chugmania/common/models/requests.js'
import {
  isErrorResponse,
  isLoginSuccessResponse,
  isRegisterSuccessResponse,
} from '@chugmania/common/models/responses.js'
import type { WhoAmIResponse } from '@chugmania/common/models/responses.js'
import type { UserInfo } from '@chugmania/common/models/user.js'
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import { useConnection } from './ConnectionContext'

type AuthContextType = {
  isLoggedIn: boolean
  token: string | null
  errorMessage: string | undefined
  user: UserInfo | null
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
  const [user, setUser] = useState<UserInfo | null>(null)

  function handleResponse(response: unknown) {
    if (isErrorResponse(response)) {
      console.error(response.message)
      return setErrorMessage(response.message)
    }

    if (isLoginSuccessResponse(response)) {
      setErrorMessage('')
      setToken(response.token)
      localStorage.setItem(AUTH_KEY, response.token)
      // Refresh socket auth so subsequent requests include the token
      socket.auth = { token: response.token }
      if (socket.connected) {
        socket.disconnect()
      }
      socket.connect()
      // fetch user info
      socket.emit(WS_WHOAMI, {}, (res: WhoAmIResponse) => {
        if (res?.success) setUser(res.user)
      })
      return
    }

    if (isRegisterSuccessResponse(response)) {
      setErrorMessage('')
      setToken(response.token)
      localStorage.setItem(AUTH_KEY, response.token)
      socket.auth = { token: response.token }
      if (socket.connected) {
        socket.disconnect()
      }
      socket.connect()
      socket.emit(WS_WHOAMI, {}, (res: WhoAmIResponse) => {
        if (res?.success) setUser(res.user)
      })
      return
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
    localStorage.removeItem(AUTH_KEY)
    setToken(null)
    setUser(null)
    // Clear token from socket auth and reconnect unauthenticated
    socket.auth = { token: undefined }
    if (socket.connected) {
      socket.disconnect()
    }
    socket.connect()
  }

  const context = useMemo(
    () =>
      ({
        isLoggedIn: !!token,
        errorMessage,
        user,
        token,
        login,
        register,
        logout,
      }) satisfies AuthContextType,
    [token, errorMessage, user]
  )

  // Ensure socket carries token on initial load and when token changes
  useEffect(() => {
    socket.auth = { token: token ?? undefined }
    // reconnect to refresh handshake auth
    if (socket.connected) socket.disconnect()
    socket.connect()
    // try load user info when token appears
    if (token) {
      socket.emit(WS_WHOAMI, {}, (res: WhoAmIResponse) => {
        if (res?.success) setUser(res.user)
      })
    } else {
      setUser(null)
    }
  }, [token])

  // Handle invalid/expired tokens from server during handshake
  useEffect(() => {
    function onConnectError(err: any) {
      const message = String(err?.message ?? '')
      if (
        message.includes('invalid signature') ||
        message.includes('jwt') ||
        message.includes('token')
      ) {
        localStorage.removeItem(AUTH_KEY)
        setToken(null)
        setUser(null)
        socket.auth = { token: undefined }
        if (socket.connected) socket.disconnect()
        socket.connect()
      }
    }
    socket.on('connect_error', onConnectError)
    return () => {
      socket.off('connect_error', onConnectError)
    }
  }, [socket])

  return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
