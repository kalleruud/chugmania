import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  LoginRequest,
  RegisterRequest,
} from '../../../common/models/requests'
import {
  type ErrorResponse,
  type LoginResponse,
} from '../../../common/models/responses.js'
import { type UserInfo } from '../../../common/models/user.js'
import {
  AUTH_KEY,
  WS_GET_USER_DATA,
  WS_LOGIN_NAME,
  WS_REGISTER_NAME,
} from '../../../common/utils/constants.js'
import { useConnection } from './ConnectionContext'

type AuthContextType = {
  isLoggedIn: boolean
  user: UserInfo | undefined
  errorMessage: string | undefined
  login: (request: LoginRequest) => void
  register: (request: RegisterRequest) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { socket, setToken } = useConnection()
  const navigate = useNavigate()
  const [userInfo, setUserInfo] = useState<AuthContextType['user']>(undefined)
  const [errorMessage, setErrorMessage] =
    useState<AuthContextType['errorMessage']>(undefined)

  function handleResponse(response: ErrorResponse | LoginResponse) {
    if (!response.success) {
      console.error(response.message)
      return setErrorMessage(response.message)
    }

    setErrorMessage(undefined)
    setUserInfo(response.userInfo)
    setToken(response.token)
  }

  const login: AuthContextType['login'] = r => {
    socket.emit(WS_LOGIN_NAME, r, handleResponse)
  }

  const register: AuthContextType['register'] = r => {
    socket.emit(WS_REGISTER_NAME, r, handleResponse)
  }

  const logout = () => {
    setToken(undefined)
    setUserInfo(undefined)
    navigate('/login')
  }

  useEffect(() => {
    if (!userInfo && localStorage.getItem(AUTH_KEY))
      socket.emit(WS_GET_USER_DATA, undefined, handleResponse)
  }, [])

  const context = useMemo(
    () =>
      ({
        isLoggedIn: !!userInfo,
        errorMessage,
        user: userInfo,
        login,
        register,
        logout,
      }) satisfies AuthContextType,
    [userInfo, errorMessage]
  )

  return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
