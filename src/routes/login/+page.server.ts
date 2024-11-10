import UserManager from '@/server/managers/user.manager'
import { fail } from '@sveltejs/kit'
import type { Actions } from './$types'

export type FormMode = 'lookup' | 'register' | 'login'

export const actions = {
  lookup: async ({ request }) => {
    try {
      const { email } = getFields(await request.formData())
      console.debug('Looking up user with email:', email)

      const exists = await UserManager.userExists(email)

      const formMode: FormMode = exists ? 'login' : 'register'
      return { formMode }
    } catch (error) {
      handleError(error)
    }
  },
  login: async ({ cookies, request }) => {
    try {
      const { email, password } = getFields(await request.formData())
      console.debug('Logging in user with email:', email)
      if (!password) return fail(400, { message: 'Password not provided' })

      const token = await UserManager.loginEmail(email, password, cookies)
      if (!token) return fail(401, { message: 'Invalid email or password' })

      return {}
    } catch (error) {
      handleError(error)
    }
  },
  register: async ({ cookies, request }) => {
    try {
      const { email, password, name } = getFields(await request.formData())
      if (!password) return fail(400, { message: 'Password not provided' })
      if (!name) return fail(400, { message: 'Name not provided' })
      console.debug('Registering user with email:', email)

      await UserManager.register(email, password, name)
      const token = await UserManager.loginEmail(email, password, cookies)
      if (!token) return fail(500, { message: 'Failed to log in user after registration' })

      return {}
    } catch (error) {
      handleError(error)
    }
  },
} satisfies Actions

function getFields(data: FormData) {
  const email = data.get('email')?.toString().trim().toLowerCase()
  if (!email) throw new Error('Email not provided')
  return {
    email,
    password: data.get('password')?.valueOf().toLocaleString(),
    name: data.get('name')?.valueOf().toLocaleString(),
  }
}

function handleError(error: unknown) {
  console.error(error)
  return fail(500, {
    message: error instanceof Error ? error.message : 'Something went wrong',
    error: error,
  })
}
