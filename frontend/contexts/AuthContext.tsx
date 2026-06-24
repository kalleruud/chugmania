import loc from '@/lib/locales'
import type { ErrorResponse } from '@common/models/socket.io'
import { type LoginResponse } from '@common/models/user'
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
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
    if (!response.success) {
      console.warn(response.message)
      clearAuthState()
      setIsLoadingAuth(false)
      return
    }

    setToken(response.token)
    setLoggedInUserId(response.userId)
    if (reconnect) socket.disconnect().connect()
    setIsLoadingAuth(false)
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

  const handleUserData = useEffectEvent((r: LoginResponse | ErrorResponse) => {
    handleResponse(r, false)
  })

  useEffect(() => {
    const onUserData = (r: LoginResponse | ErrorResponse) => handleUserData(r)
    socket.on('user_data', onUserData)
    return () => {
      socket.off('user_data', onUserData)
    }
  }, [socket])

  const context: AuthContextType = loggedInUser
    ? {
        isLoading,
        isLoggedIn: true,
        loggedInUser,
        login: undefined,
        logout,
      }
    : {
        isLoading,
        isLoggedIn: false,
        login,
        loggedInUser: undefined,
        logout: undefined,
      }

  return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
}
