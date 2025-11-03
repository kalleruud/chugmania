import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Home() {
  const navigate = useNavigate()
  const { isLoggedIn, logout, user } = useAuth()

  const goToLogin = () => navigate('/login')
  const goToTracks = () => navigate('/tracks')

  const signedInLabel = user?.shortName ?? user?.firstName ?? user?.email

  return (
    <div className='flex h-dvh w-full flex-col items-center justify-center gap-6 p-4' />
  )
}
