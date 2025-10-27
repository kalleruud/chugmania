import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../components/Button'
import UserForm from '../components/UserForm'

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
      <div className='grid w-full max-w-md items-start gap-4 p-6'>
        <div className='text-center'>
          <h1 className='text-accent text-2xl font-extrabold uppercase tracking-wider'>
            {isRegistering ? 'Sign Up' : 'Sign In'}
          </h1>
          <p className='text-label-secondary text-xs'>
            Fuel your session and hit the track
          </p>
        </div>

        <UserForm
          mode={isRegistering ? 'register' : 'login'}
          email={email}
          firstName={firstName}
          lastName={lastName}
          shortName={shortName}
          password={password}
          onEmailChange={setEmail}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
          onShortNameChange={setShortName}
          onPasswordChange={setPassword}
          onSubmit={handleSubmit}
          errorMessage={errorMessage}
        />

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
      </div>
    </div>
  )
}
