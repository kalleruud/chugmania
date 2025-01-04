import UserManager from '@/server/managers/user.manager'
import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load = (async ({ locals }) => {
  const users = await UserManager.getAll()
  if (!locals.user) throw redirect(302, locals.redirect ?? '/login')

  return { users, loggedInUser: locals.user }
}) satisfies PageServerLoad
