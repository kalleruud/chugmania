import Login from './components/Login'
import { useAuth } from './contexts/AuthContext'
import Home from './Home'

function App() {
  const { isLoggedIn } = useAuth()

  if (!isLoggedIn) return <Login />
  return <Home />
}

export default App
