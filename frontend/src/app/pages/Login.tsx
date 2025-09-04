import { AtSign, Lock, Type, User } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Login() {
  const { login, register, errorMessage, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    isRegistering
      ? register({ email, name, shortName, password })
      : login({ email, password })
  }

  useEffect(() => {
    if (isLoggedIn) return navigate('/')
  }, [isLoggedIn])

  function isInputValid() {
    return email.length >= 8 && email.includes('@') && password.length >= 8
  }

  return (
    <div className='flex w-full items-center justify-center p-6'>
      <form
        onSubmit={handleSubmit}
        className='font-f1 bg-background-secondary grid w-full max-w-sm gap-4 rounded-2xl border border-white/10 p-6 text-sm shadow-2xl backdrop-blur-xl'
      >
        <div className='text-center'>
          <h2 className='text-accent text-2xl font-extrabold uppercase tracking-wider'>
            {isRegistering ? 'Sign Up' : 'Sign In'}
          </h2>
          <p className='text-label-secondary text-xs'>
            Fuel your session and hit the track
          </p>
        </div>

        <div className='grid gap-3'>
          <label className='grid gap-1'>
            <span className='sr-only'>Email</span>
            <div className='relative'>
              <AtSign className='text-label-muted absolute left-3 top-1/2 size-4 -translate-y-1/2' />
              <input
                type='email'
                minLength={8}
                placeholder='you@example.com'
                value={email}
                onChange={e => setEmail(e.target.value)}
                className='focus:ring-accent/60 focus:border-accent placeholder:text-label-muted w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-3 outline-none transition focus:ring-2'
              />
            </div>
          </label>

          {isRegistering && (
            <>
              <label className='grid gap-1'>
                <span className='sr-only'>Name</span>
                <div className='relative'>
                  <User className='text-label-muted absolute left-3 top-1/2 size-4 -translate-y-1/2' />
                  <input
                    type='text'
                    value={name}
                    maxLength={12}
                    minLength={2}
                    placeholder='Ola Normann'
                    onChange={e => setName(e.target.value)}
                    className='focus:ring-accent/60 focus:border-accent placeholder:text-label-muted w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-3 outline-none transition focus:ring-2'
                  />
                </div>
              </label>
              <label className='grid gap-1'>
                <span className='sr-only'>Short Name</span>
                <div className='relative'>
                  <Type className='text-label-muted absolute left-3 top-1/2 size-4 -translate-y-1/2' />
                  <input
                    type='text'
                    maxLength={3}
                    minLength={3}
                    placeholder='NOR'
                    value={shortName}
                    onChange={e => setShortName(e.target.value.toUpperCase())}
                    className='focus:ring-accent/60 focus:border-accent placeholder:text-label-muted w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-3 uppercase outline-none transition focus:ring-2'
                  />
                </div>
              </label>
            </>
          )}

          <label className='grid gap-1'>
            <span className='sr-only'>Password</span>
            <div className='relative'>
              <Lock className='text-label-muted absolute left-3 top-1/2 size-4 -translate-y-1/2' />
              <input
                type='password'
                value={password}
                maxLength={32}
                minLength={8}
                placeholder='••••••••'
                onChange={e => setPassword(e.target.value)}
                className='focus:ring-accent/60 focus:border-accent placeholder:text-label-muted w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-3 outline-none transition focus:ring-2'
              />
            </div>
          </label>
        </div>

        {errorMessage && (
          <p className='rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300'>
            {errorMessage}
          </p>
        )}

        <button
          type='submit'
          disabled={!isInputValid()}
          className='to-accent-secondary from-accent shadow-accent/60 w-full rounded-lg bg-gradient-to-br py-2 font-semibold uppercase tracking-wider shadow-[0_10px_30px_-10px_rgba(var(--color-accent),0.6)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'
        >
          {isRegistering ? 'Sign up' : 'Sign in'}
        </button>

        <button
          type='button'
          onClick={() => setIsRegistering(!isRegistering)}
          className='text-accent/90 hover:text-accent text-xs underline-offset-4 transition hover:underline'
        >
          {isRegistering
            ? 'Already racing? Sign in'
            : 'New driver? Create an account'}
        </button>
      </form>
    </div>
  )
}
