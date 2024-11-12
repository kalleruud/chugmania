import SessionManager from '@/server/managers/session.manager'
import { type Actions } from '@sveltejs/kit'
import { handleError } from '../../../hooks.server'
import type { PageServerLoad } from './$types'
import TrackManager from '@/server/managers/track.manager'

export const load = (async ({ params, locals }) => {
  if (!locals.user) throw new Error('Unauthorized')
  const session = await SessionManager.get(params.session)
  const tracks = await SessionManager.getTracksWithEntries(params.session)
  const allTracks = await TrackManager.getAll()

  return { session, tracks, allTracks }
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
