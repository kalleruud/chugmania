import { LogIn, LogOut, Map } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from '../../locales/useTranslation'
import { Button } from '../components/Button'

export default function Home() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isLoggedIn, logout, user } = useAuth()

  const goToLogin = () => navigate('/login')
  const goToTracks = () => navigate('/tracks')

  const signedInLabel = user?.shortName ?? user?.firstName ?? user?.email

  return (
    <div className='p-safe-or-4 grid h-screen place-items-center'>
      <section className='rounded-3xl border border-white/10 bg-black/60 p-6 text-center shadow-[0_25px_60px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-10'>
        <p className='text-label-secondary text-xs uppercase tracking-[0.35em]'>
          {t('pages.home.subtitle')}
        </p>
        <h1 className='font-f1-black mt-3 text-3xl uppercase text-white sm:text-4xl'>
          {isLoggedIn
            ? t('pages.home.welcomeSignedIn')
            : t('pages.home.welcomeSignedOut')}
        </h1>
        <p className='text-label-muted mt-3 text-sm leading-relaxed sm:text-base'>
          {isLoggedIn
            ? t('pages.home.descriptionSignedIn', {
                signedInLabel: signedInLabel ?? 'your account',
              })
            : t('pages.home.descriptionSignedOut')}
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
                {t('common.signOut')}
              </Button>

              <Button
                type='button'
                variant='primary'
                size='md'
                onClick={goToTracks}
                className='w-full'>
                <Map size={18} />
                {t('pages.home.viewTracks')}
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
                {t('common.signIn')}
              </Button>

              <Button
                type='button'
                variant='secondary'
                size='md'
                onClick={goToTracks}
                className='w-full'>
                <Map size={18} />
                {t('pages.home.browseTracks')}
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
