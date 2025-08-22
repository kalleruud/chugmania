import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { type BackendResponse } from '../../../common/models/responses'
import { useConnection } from './ConnectionContext'

type AuthContextType = {
  isLoggedIn: boolean
  token: string | null
  login: (username: string, password: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { socket } = useConnection()
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt'))

  function handleLoginResponse(response: BackendResponse) {
    if (!response.isSuccess) return console.error(response.error.message)

    setToken(response.token)
    localStorage.setItem('jwt', response.token)
  }

  const login = (username: string, password: string) => {
    socket.emit('login', { username, password }, handleLoginResponse)
  }

  const logout = () => {
    socket.emit('logout')
    localStorage.removeItem('jwt')
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
