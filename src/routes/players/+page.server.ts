import UserManager from '@/server/managers/user.manager'
import type { PageServerLoad } from './$types'

export const load = (async ({ locals }) => {
  const users = await UserManager.getAll()
  return { users, loggedInUser: locals.user }
}) satisfies PageServerLoad
