import * as db from '$lib/server/db'
import SessionManager from '@/server/managers/session.manager'
import type { PageServerLoad } from './$types'
import { fail, type Actions } from '@sveltejs/kit'
import { handleError } from '../../../hooks.server'

export const load = (async route => {
  return {
    session: await SessionManager.get(route.params.session),
    entries: await db.getTimeEntries(route.params.session),
  }
}) satisfies PageServerLoad

export const actions = {
  create: async ({ cookies }) => {
    try {
      console.debug('Received create time entry request')
      const token = cookies.get('auth')
      if (!token) return fail(401, { message: 'No token provided' })

      const user = db.verifyToken(token)
      if (!user) return fail(401, { message: 'Invalid token' })

      // TODO: Implement time entry creation

      return { success: true }
    } catch (error) {
      handleError(error)
    }
  },
} satisfies Actions
