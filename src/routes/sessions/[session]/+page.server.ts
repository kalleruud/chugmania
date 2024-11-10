import SessionManager from '@/server/managers/session.manager'
import TrackManager from '@/server/managers/track.manager'
import { type Actions } from '@sveltejs/kit'
import { handleError } from '../../../hooks.server'
import type { PageServerLoad } from './$types'

export const load = (async route => {
  return {
    session: await SessionManager.get(route.params.session),
    tracks: await TrackManager.getAll(),
  }
}) satisfies PageServerLoad

export const actions = {
  add: async () => {
    try {
      console.log("Adding track")

      return { success: true }
    } catch (error) {
      handleError(error)
    }
  },
} satisfies Actions
