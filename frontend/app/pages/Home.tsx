import { LogIn, LogOut, Map } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../components/Button'

export default function Home() {
  const navigate = useNavigate()
  const { isLoggedIn, logout, user } = useAuth()

  const goToLogin = () => navigate('/login')
  const goToTracks = () => navigate('/tracks')

  const signedInLabel = user?.shortName ?? user?.firstName ?? user?.email

  return (
    <div className='p-safe-or-4 grid h-screen place-items-center'>
      <section className='rounded-3xl border border-white/10 bg-black/60 p-6 text-center shadow-[0_25px_60px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-10'>
        <p className='text-label-secondary text-xs uppercase tracking-[0.35em]'>
          Trackmania Turbo Lap Tracker
        </p>
        <h1 className='font-f1-black mt-3 text-3xl uppercase text-white sm:text-4xl'>
          {isLoggedIn ? 'Back in the pit lane' : 'Welcome to Chugmania'}
        </h1>
        <p className='text-label-muted mt-3 text-sm leading-relaxed sm:text-base'>
          {isLoggedIn
            ? `Signed in as ${signedInLabel ?? 'your account'}. Manage your lap times, scout fresh leaderboards, and keep your edge.`
            : 'Log your Trackmania Turbo laps, chase the global leaderboards, and monitor every improvement as it happens.'}
        </p>

        <div className='mt-6 grid gap-3 sm:grid-cols-2'>
          {isLoggedIn ? (
            <>
              <Button
                type='button'
                variant='secondary'
                size='md'
                onClick={logout}
                className='w-full'>
                <LogOut size={18} />
                Sign out
              </Button>

              <Button
                type='button'
                variant='primary'
                size='md'
                onClick={goToTracks}
                className='w-full'>
                <Map size={18} />
                View tracks
              </Button>
            </>
          ) : (
            <>
              <Button
                type='button'
                variant='primary'
                size='md'
                onClick={goToLogin}
                className='w-full'>
                <LogIn size={18} />
                Sign in
              </Button>

              <Button
                type='button'
                variant='secondary'
                size='md'
                onClick={goToTracks}
                className='w-full'>
                <Map size={18} />
                Browse tracks
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
