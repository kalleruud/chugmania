import loc from '@/lib/locales'
import type { ErrorResponse } from '@common/models/socket.io'
import { type LoginResponse } from '@common/models/user'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { AuthContext, type AuthContextType } from './auth-context'
import { useConnection } from './useConnection'
import { useData } from './useData'

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
