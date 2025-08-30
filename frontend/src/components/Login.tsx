import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useConnection } from '../contexts/ConnectionContext'

export default function Login() {
  const { login } = useAuth()
  const { isConnected } = useConnection()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }

    setError('')
    login(email, password)
  }

  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-100'>
      <form
        onSubmit={handleSubmit}
        className='bg-white grid text-sm font-medium p-6 rounded-2xl shadow-md w-80 gap-2'
      >
        <h2 className='text-2xl font-semibold text-center'>Login</h2>
        <p className='font-mono'>
          Is connected: {isConnected ? 'True' : 'False'}
        </p>

        <div className='grid gap-1'>
          <label className='grid gap-1'>
            <p>Email</p>
            <input
              type='text'
              value={email}
              onChange={e => setEmail(e.target.value)}
              className='w-full p-2 border transition rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </label>
          <label className='grid gap-1'>
            <p>Password</p>
            <input
              type='password'
              value={password}
              onChange={e => setPassword(e.target.value)}
              className='w-full p-2 border transition rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </label>
        </div>

        {error && (
          <p className='text-red-700 border-red-400 border-1 rounded-xl p-4 bg-red-200 text-sm'>
            {error}
          </p>
        )}

        <button
          type='submit'
          disabled={email.length < 2 && password.length < 8}
          className='w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 hover:cursor-pointer disabled:hover:cursor-not-allowed'
        >
          <p>Login</p>
        </button>
      </form>
    </div>
  )
}
