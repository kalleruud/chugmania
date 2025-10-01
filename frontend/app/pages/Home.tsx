import { LogIn, LogOut, Map } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Home() {
  const navigate = useNavigate()
  const { isLoggedIn, logout, user } = useAuth()

  const goToLogin = () => navigate('/login')
  const goToTracks = () => navigate('/tracks')

  const signedInLabel = user?.shortName ?? user?.firstName ?? user?.email

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-24 pt-6 sm:px-6 sm:pb-12 sm:pt-10'>
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
              <button
                type='button'
                onClick={logout}
                className='inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-slate-100 shadow-lg transition hover:border-white/20 hover:bg-white/10 active:scale-[0.99]'
              >
                <LogOut size={18} />
                Sign out
              </button>

              <button
                type='button'
                onClick={goToTracks}
                className='to-accent-secondary from-accent shadow-accent/60 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br px-4 py-3 text-sm font-semibold uppercase tracking-wider text-black shadow-[0_10px_30px_-10px_rgba(var(--color-accent),0.6)] transition hover:opacity-95 active:scale-[0.99]'
              >
                <Map size={18} />
                View tracks
              </button>
            </>
          ) : (
            <>
              <button
                type='button'
                onClick={goToLogin}
                className='to-accent-secondary from-accent shadow-accent/60 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br px-4 py-3 text-sm font-semibold uppercase tracking-wider text-black shadow-[0_10px_30px_-10px_rgba(var(--color-accent),0.6)] transition hover:opacity-95 active:scale-[0.99]'
              >
                <LogIn size={18} />
                Sign in
              </button>

              <button
                type='button'
                onClick={goToTracks}
                className='inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-slate-100 shadow-lg transition hover:border-white/20 hover:bg-white/10 active:scale-[0.99]'
              >
                <Map size={18} />
                Browse tracks
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
