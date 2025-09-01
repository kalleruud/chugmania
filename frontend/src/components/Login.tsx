import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'

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
    <div className='flex items-center justify-center min-h-screen bg-gray-100'>
      <form
        onSubmit={handleSubmit}
        className='bg-white grid text-sm font-medium p-6 rounded-2xl shadow-md w-80 gap-2'
      >
        <h2 className='text-2xl font-semibold text-center'>
          {isRegistering ? 'Register' : 'Login'}
        </h2>

        <div className='grid gap-1'>
          <label className='grid gap-1'>
            <p>Email</p>
            <input
              type='email'
              minLength={8}
              placeholder='ola@normann.no'
              value={email}
              onChange={e => setEmail(e.target.value)}
              className='w-full p-2 border transition rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </label>
          {isRegistering && (
            <>
              <label className='grid gap-1'>
                <p>Name</p>
                <input
                  type='text'
                  value={name}
                  maxLength={12}
                  minLength={2}
                  placeholder='Ola Normann'
                  onChange={e => setName(e.target.value)}
                  className='w-full p-2 border transition rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </label>
              <label className='grid gap-1'>
                <p>Short Name</p>
                <input
                  type='text'
                  maxLength={3}
                  minLength={3}
                  placeholder='NOR'
                  value={shortName}
                  onChange={e => setShortName(e.target.value.toUpperCase())}
                  className='w-full p-2 border transition rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </label>
            </>
          )}
          <label className='grid gap-1'>
            <p>Password</p>
            <input
              type='password'
              value={password}
              maxLength={32}
              minLength={8}
              placeholder='P@55w0rd'
              onChange={e => setPassword(e.target.value)}
              className='w-full p-2 border transition rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </label>
        </div>

        {errorMessage && (
          <p className='text-red-700 border-red-400 border-1 rounded-xl p-4 bg-red-200 text-sm'>
            {errorMessage}
          </p>
        )}

        <button
          type='submit'
          disabled={!isInputValid()}
          className='w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 hover:cursor-pointer disabled:hover:cursor-not-allowed'
        >
          <p>{isRegistering ? 'Register' : 'Login'}</p>
        </button>

        <button
          type='button'
          onClick={() => setIsRegistering(!isRegistering)}
          className='text-blue-600 hover:text-blue-700 py-2 rounded-lg transition-colors hover:cursor-pointer'
        >
          <p>
            {isRegistering
              ? 'Already have an account? Login'
              : 'Create account'}
          </p>
        </button>
      </form>
    </div>
  )
}
