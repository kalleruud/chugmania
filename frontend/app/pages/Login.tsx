import { AtSign, Lock, Type, User, type LucideProps } from 'lucide-react'
import {
  useEffect,
  useState,
  type ComponentType,
  type DetailedHTMLProps,
  type FormEvent,
  type InputHTMLAttributes,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../components/Button'

function Field({
  Icon,
  name,
  className,
  ...props
}: { Icon?: ComponentType<LucideProps> } & DetailedHTMLProps<
  InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>) {
  return (
    <label className='focus-within:ring-accent/60 focus-within:border-accent flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition focus-within:ring-2'>
      <span className='sr-only'>{name}</span>

      {Icon && <Icon className='text-label-muted size-4' />}
      <input
        name={name}
        className={twMerge(
          'placeholder:text-label-muted/50 w-full outline-none transition focus:ring-transparent',
          className
        )}
        {...props}
      />
    </label>
  )
}

export default function Login() {
  const { login, register, errorMessage, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [shortName, setShortName] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const payload = {
      email: email.trim(),
      password,
    }

    if (isRegistering) {
      register({
        ...payload,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        shortName: shortName.trim().toUpperCase(),
      })
    } else {
      login(payload)
    }
  }

  useEffect(() => {
    if (!isLoggedIn) return
    const redirectTo = searchParams.get('redirect') ?? '/'
    navigate(redirectTo)
  }, [isLoggedIn, searchParams, navigate])

  return (
    <div className='font-f1 flex h-dvh w-full items-center justify-center sm:items-baseline'>
      <form
        onSubmit={handleSubmit}
        className='grid w-full max-w-md items-start gap-4 p-6'>
        <div className='text-center'>
          <h1 className='text-accent text-2xl font-extrabold uppercase tracking-wider'>
            {isRegistering ? 'Sign Up' : 'Sign In'}
          </h1>
          <p className='text-label-secondary text-xs'>
            Fuel your session and hit the track
          </p>
        </div>

        <div className='grid gap-3'>
          <Field
            name='Email'
            Icon={AtSign}
            type='email'
            value={email}
            placeholder='you@example.com'
            required={true}
            onChange={e => setEmail(e.target.value)}
          />

          {isRegistering && (
            <>
              <div className='flex gap-2'>
                <Field
                  name='First name'
                  Icon={User}
                  type='text'
                  value={firstName}
                  placeholder='Ola'
                  maxLength={24}
                  minLength={2}
                  required={true}
                  onChange={e => setFirstName(e.target.value)}
                />

                <Field
                  name='Last name'
                  type='text'
                  value={lastName}
                  placeholder='Normann'
                  maxLength={24}
                  minLength={2}
                  required={true}
                  onChange={e => setLastName(e.target.value)}
                />
              </div>

              <Field
                name='Short name'
                type='text'
                Icon={Type}
                maxLength={3}
                minLength={3}
                placeholder='NOR'
                required={true}
                value={shortName}
                onChange={e => setShortName(e.target.value.toUpperCase())}
              />
            </>
          )}

          <Field
            name='Password'
            Icon={Lock}
            type='password'
            value={password}
            maxLength={32}
            minLength={8}
            placeholder='••••••••'
            required={true}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        {errorMessage && (
          <p className='rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300'>
            {errorMessage}
          </p>
        )}

        <Button type='submit' variant='primary' size='md' className='w-full'>
          {isRegistering ? 'Sign up' : 'Sign in'}
        </Button>

        <Button
          type='button'
          variant='tertiary'
          size='sm'
          onClick={() => setIsRegistering(!isRegistering)}
          className='text-xs normal-case'>
          {isRegistering
            ? 'Already racing? Sign in'
            : 'New driver? Create an account'}
        </Button>
      </form>
    </div>
  )
}
