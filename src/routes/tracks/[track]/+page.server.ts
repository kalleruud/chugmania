import TrackManager from '@/server/managers/track.manager'
import type { Actions, PageServerLoad } from './$types'

export const load = (async ({ params, locals }) => {
  if (!locals.user) throw new Error('Unauthorized')
  return {
    user: locals.user,
    track: await TrackManager.get(params.track),
  }
}) satisfies PageServerLoad

export const actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw new Error('Unauthorized')
    if (locals.user.role !== 'admin') throw new Error('Forbidden')

    return {
      track: await TrackManager.create(await request.formData()),
    }
  },
  toggleChuggable: async ({ params, locals }) => {
    if (!locals.user) throw new Error('Unauthorized')
    if (locals.user.role !== 'admin') throw new Error('Forbidden')

    const track = await TrackManager.get(params.track)
    TrackManager.update(params.track, !track.isChuggable)
  },
} satisfies Actions
