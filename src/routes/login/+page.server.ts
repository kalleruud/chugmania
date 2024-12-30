import LoginManager from '@/server/managers/login.manager'
import { redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load = (async ({ locals }) => {
  if (locals.user) throw redirect(303, locals.redirect ?? '/')

  return {}
}) satisfies PageServerLoad

export const actions = {
  login: async ({ cookies, request }) =>
    await LoginManager.login(await request.formData(), cookies),
  register: async ({ request }) => LoginManager.register(await request.formData()),
} satisfies Actions
