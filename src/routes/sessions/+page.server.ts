import * as db from '$lib/server/db'
import { verifyToken } from '$lib/server/db'
import { fail, type Actions } from '@sveltejs/kit'
import { handleError } from '../../hooks.server'
import type { PageServerLoad } from './$types'

export const load = (async () => {
  return {
    sessions: await db.getSessions(),
  }
}) satisfies PageServerLoad

export const actions = {
  create: async ({ cookies }) => {
    try {
      console.debug('Received create session request')
      const token = cookies.get('auth')
      if (!token) return fail(401, { message: 'No token provided' })

      const user = verifyToken(token)
      if (!user) return fail(401, { message: 'Invalid token' })

      await db.createSession({
        type: 'practice',
        createdBy: user.id,
      })

      return { success: true }
    } catch (error) {
      handleError(error)
    }
  },
} satisfies Actions
