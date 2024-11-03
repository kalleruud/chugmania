import * as db from '$lib/server/db'
import { fail } from '@sveltejs/kit'
import type { Actions } from './$types'

export type FormMode = 'lookup' | 'register' | 'login'

export const actions = {
  lookup: async ({ request }) => {
    try {
      const { email } = getFields(await request.formData())
      console.debug('Looking up user with email:', email)

      const exists = await db.userExists(email)

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

      const token = await db.login(email, password!)
      if (!token) {
        return fail(401, {
          message: 'Invalid email or password',
        })
      }

      cookies.set('auth', token, { path: '/' })

      return {}
    } catch (error) {
      handleError(error)
    }
  },
  register: async ({ cookies, request }) => {
    try {
      const { email, password, name } = getFields(await request.formData())
      console.debug('Registering user with email:', email)

      await db.register(email, password!, name!)
      const token = await db.login(email, password!)
      cookies.set('auth', token!, { path: '/' })

      return {}
    } catch (error) {
      handleError(error)
    }
  },
} satisfies Actions

function getFields(data: FormData) {
  return {
    email: data.get('email')!.valueOf().toLocaleString().toLowerCase().trim(),
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
