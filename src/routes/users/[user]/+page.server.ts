import UserManager from '@/server/managers/user.manager'
import type { PageServerLoad } from './$types'

export const load = (async ({ params, locals }) => {
  if (!locals.user) throw new Error('Unauthorized')

  const loggedInUser = locals.user
  const user = await UserManager.getUserByEmail(params.user)

  return { user, loggedInUser }
}) satisfies PageServerLoad
