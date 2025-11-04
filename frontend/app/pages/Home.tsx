import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Home() {
  const navigate = useNavigate()
  const { isLoggedIn, logout, user } = useAuth()

  const goToLogin = () => navigate('/login')
  const goToTracks = () => navigate('/tracks')

  const signedInLabel = user?.shortName ?? user?.firstName ?? user?.email

  return (
    <div className='flex w-full flex-col items-center justify-center'>
      <h1 className='w-full text-center text-9xl'>Chug</h1>
      <h1 className='w-full text-center text-8xl'>mania</h1>
    </div>
  )
}
