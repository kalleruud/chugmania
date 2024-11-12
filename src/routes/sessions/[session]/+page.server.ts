import SessionManager from '@/server/managers/session.manager'
import { type Actions } from '@sveltejs/kit'
import { handleError } from '../../../hooks.server'
import type { PageServerLoad } from './$types'

export const load = (async ({ params, locals }) => {
  if (!locals.user) throw new Error('Unauthorized')
  const session = await SessionManager.get(params.session)
  const tracks = await SessionManager.getTracksWithEntries(params.session)

  return { session, tracks }
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
