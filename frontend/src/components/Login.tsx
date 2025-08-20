import React, { useState } from 'react'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!username || !password) {
      setError('Please enter both username and password.')
      return
    }

    setError('')
    // Replace this with your actual login logic
    console.log('Logging in with:', { username, password })
  }

  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-100'>
      <form
        onSubmit={handleSubmit}
        className='bg-white grid text-sm font-medium p-6 rounded-2xl shadow-md w-80 gap-2'
      >
        <h2 className='text-2xl font-semibold text-center'>Login</h2>

        <div>
          <label className='grid gap-1'>
            <p>Username</p>
            <input
              type='text'
              value={username}
              onChange={e => setUsername(e.target.value)}
              className='w-full p-2 border transition rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </label>
          <label className='grid gap-1'>
            <p>Password</p>
            <input
              type='password'
              value={password}
              onChange={e => setPassword(e.target.value)}
              className='w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </label>
        </div>

        {error && <p className='text-red-700 border-red-400 border-1 rounded-xl p-4 bg-red-200 text-sm'>{error}</p>}

        <button
          type='submit'
          className='w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition'
        >
          Login
        </button>
      </form>
    </div>
  )
}

export default Login
