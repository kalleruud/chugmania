import SessionManager from '@/server/managers/session.manager'
import TrackManager from '@/server/managers/track.manager'
import { type Actions } from '@sveltejs/kit'
import { handleError } from '../../../hooks.server'
import type { PageServerLoad } from './$types'

export const load = (async ({ params, locals }) => {
  if (!locals.user) throw new Error('Unauthorized')

  return {
    session: await SessionManager.get(params.session),
    tracks: await TrackManager.getAll(),
  }
}) satisfies PageServerLoad

export const actions = {
  add: async () => {
    try {
      console.log('Adding track')

      return { success: true }
    } catch (error) {
      handleError(error)
    }
  },
} satisfies Actions
