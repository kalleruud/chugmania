import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { AtSign, Lock, User, Type } from 'lucide-react'

export default function Login() {
  const { login, register, errorMessage } = useAuth()
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

  function isInputValid() {
    return email.length >= 8 && email.includes('@') && password.length >= 8
  }

  return (
    <div className='min-h-screen w-full text-slate-100 flex items-center justify-center p-6'>
      <form
        onSubmit={handleSubmit}
        className='w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-6 grid gap-4 text-sm font-f1'
      >
        <div className='text-center'>
          <h2 className='text-2xl font-extrabold tracking-wider uppercase text-[var(--f1-accent)]'>
            {isRegistering ? 'Sign Up' : 'Sign In'}
          </h2>
          <p className='text-slate-400 text-xs'>
            Fuel your session and hit the track
          </p>
        </div>

        <div className='grid gap-3'>
          <label className='grid gap-1'>
            <span className='sr-only'>Email</span>
            <div className='relative'>
              <AtSign className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400' />
              <input
                type='email'
                minLength={8}
                placeholder='you@example.com'
                value={email}
                onChange={e => setEmail(e.target.value)}
                className='w-full pl-10 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[var(--f1-accent)]/60 focus:border-[var(--f1-accent)] transition'
              />
            </div>
          </label>

          {isRegistering && (
            <>
              <label className='grid gap-1'>
                <span className='sr-only'>Name</span>
                <div className='relative'>
                  <User className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400' />
                  <input
                    type='text'
                    value={name}
                    maxLength={12}
                    minLength={2}
                    placeholder='Ola Normann'
                    onChange={e => setName(e.target.value)}
                    className='w-full pl-10 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[var(--f1-accent)]/60 focus:border-[var(--f1-accent)] transition'
                  />
                </div>
              </label>
              <label className='grid gap-1'>
                <span className='sr-only'>Short Name</span>
                <div className='relative'>
                  <Type className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400' />
                  <input
                    type='text'
                    maxLength={3}
                    minLength={3}
                    placeholder='NOR'
                    value={shortName}
                    onChange={e => setShortName(e.target.value.toUpperCase())}
                    className='w-full pl-10 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[var(--f1-accent)]/60 focus:border-[var(--f1-accent)] transition uppercase'
                  />
                </div>
              </label>
            </>
          )}

          <label className='grid gap-1'>
            <span className='sr-only'>Password</span>
            <div className='relative'>
              <Lock className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400' />
              <input
                type='password'
                value={password}
                maxLength={32}
                minLength={8}
                placeholder='••••••••'
                onChange={e => setPassword(e.target.value)}
                className='w-full pl-10 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[var(--f1-accent)]/60 focus:border-[var(--f1-accent)] transition'
              />
            </div>
          </label>
        </div>

        {errorMessage && (
          <p className='text-red-300 border border-red-500/30 rounded-lg p-3 bg-red-500/10 text-xs'>
            {errorMessage}
          </p>
        )}

        <button
          type='submit'
          disabled={!isInputValid()}
          className='w-full rounded-lg py-2 font-semibold uppercase tracking-wider bg-gradient-to-r from-[var(--f1-accent)] to-[#ff3b2f] text-white shadow-[0_10px_30px_-10px_rgba(225,6,0,0.6)] hover:from-[#ff3b2f] hover:to-[var(--f1-accent)] active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {isRegistering ? 'Enter the Grid' : 'Lights Out'}
        </button>

        <button
          type='button'
          onClick={() => setIsRegistering(!isRegistering)}
          className='text-[var(--f1-accent)]/90 hover:text-[var(--f1-accent)] text-xs underline-offset-4 hover:underline transition'
        >
          {isRegistering
            ? 'Already racing? Sign in'
            : 'New driver? Create an account'}
        </button>
      </form>
    </div>
  )
}
