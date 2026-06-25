import loc from '@common/locale/locales'
import type { LoginRequest } from '@common/models/auth'
import type { ErrorResponse, EventRes } from '@common/models/socket.io'
import { type LoginResponse, type UserInfo } from '@common/models/user'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { useConnection } from './ConnectionContext'
import { useData } from './DataContext'

type AuthContextType = {
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

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { users } = useData()
  const { socket, setToken } = useConnection()
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [loggedInUserId, setLoggedInUserId] = useState<string | undefined>(
    undefined
  )
  const loggedInUser = loggedInUserId
    ? users?.find(u => loggedInUserId === u.id)
    : undefined
  const isLoading =
    isLoadingAuth || (loggedInUserId !== undefined && users === undefined)

  function clearAuthState() {
    setToken(undefined)
    setLoggedInUserId(undefined)
  }

  function handleResponse(
    response: LoginResponse | ErrorResponse,
    reconnect: boolean = true
  ) {
    try {
      if (!response.success) {
        console.warn(response.message)
        clearAuthState()
        return
      }

      setToken(response.token)
      setLoggedInUserId(response.userId)
      if (reconnect) socket.disconnect().connect()
    } finally {
      setIsLoadingAuth(false)
    }
  }

  const login: Required<AuthContextType>['login'] = async r => {
    setIsLoadingAuth(true)
    const response = await socket.emitWithAck('login', {
      type: 'LoginRequest',
      ...r,
    })

    if (response.success) {
      toast.info(loc.no.user.login.request.success)
    } else {
      toast.error(loc.no.user.login.request.error(new Error(response.message)))
    }

    handleResponse(response)
    return response
  }

  const logout = () => {
    clearAuthState()
    socket.disconnect().connect()
  }

  useEffect(() => {
    socket.on('user_data', r => handleResponse(r, false))
    return () => {
      socket.off('user_data')
    }
  }, [])

  const context = useMemo<AuthContextType>(() => {
    if (loggedInUser)
      return {
        isLoading,
        isLoggedIn: true,
        loggedInUser,
        logout,
      }
    else
      return {
        isLoading,
        isLoggedIn: false,
        login,
      }
  }, [isLoading, loggedInUser])

  return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
