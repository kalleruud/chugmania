import UserManager from '@/server/managers/user.manager'
import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { isFailed } from '@/server/managers/utils'

export const load = (async ({ locals }) => {
  if (locals.user) throw redirect(303, locals.redirect ?? '/')

  return {}
}) satisfies PageServerLoad

export const actions = {
  login: async ({ cookies, request }) => {
    try {
      const { email, password } = getFields(await request.formData())
      console.debug('Logging in user with email:', email)
      if (!password) return fail(400, { message: 'Password not provided' })

      const result = await UserManager.loginEmail(email, password, cookies)
      if (isFailed(result)) return fail(result.status, { message: result.message })

      return {}
    } catch (error) {
      handleError(error)
    }
  },
  register: async ({ cookies, request }) => {
    try {
      const { email, password, name } = getFields(await request.formData())
      console.debug('Registering user with email:', email)
      if (!password) return fail(400, { message: 'Password not provided' })
      if (!name) return fail(400, { message: 'Name not provided' })
      console.debug('Registering user with email:', email)

      await UserManager.register(email, password, name)
      const result = await UserManager.loginEmail(email, password, cookies)
      if (isFailed(result))
        return fail(500, { message: 'Failed to log in user after registration: ' + result.message })

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
