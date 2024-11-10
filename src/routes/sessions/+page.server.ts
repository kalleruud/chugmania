import SessionManager from '@/server/managers/session.manager'
import { type Actions } from '@sveltejs/kit'
import { handleError } from '../../hooks.server'
import type { PageServerLoad } from './$types'

export const load = (async ({ locals }) => {
  if (!locals.user) throw new Error('Unauthorized')

  return {
    sessions: await SessionManager.getAll(locals.user?.email),
  }
}) satisfies PageServerLoad

export const actions = {
  create: async ({ locals }) => {
    try {
      console.debug('Received create session request')
      if (!locals.user) throw new Error('Unauthorized')

      await SessionManager.create('practice', locals.user)

      return { success: true }
    } catch (error) {
      handleError(error)
    }
  },
} satisfies Actions
