import UserManager from '@/server/managers/user.manager'
import type { Actions, PageServerLoad } from './$types'
import LoginManager from '@/server/managers/login.manager'
import { redirect } from '@sveltejs/kit'

export const load = (async ({ locals }) => {
  const users = await UserManager.getAll()
  if (!locals.user) throw redirect(302, locals.redirect ?? '/login')

  return { users, loggedInUser: locals.user }
}) satisfies PageServerLoad

export const actions = {
  login: async ({ cookies, request }) =>
    await LoginManager.login(await request.formData(), cookies),
  register: async ({ request }) => LoginManager.register(await request.formData()),
} satisfies Actions
