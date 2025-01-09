import TrackManager from '@/server/managers/track.manager'
import type { PageServerLoad } from './$types'

export const load = (async () => {
  return {
    tracks: TrackManager.getAll(),
  }
}) satisfies PageServerLoad
