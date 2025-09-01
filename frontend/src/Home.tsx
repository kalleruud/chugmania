import { useAuth } from './contexts/AuthContext'

export default function Home() {
  const { logout } = useAuth()
  return (
    <>
      <h1>Home</h1>
      <button onClick={() => logout()}>Logout</button>
    </>
  )
}
