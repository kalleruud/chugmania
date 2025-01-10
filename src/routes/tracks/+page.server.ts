import type { LookupEntity } from '@/components/types.server'
import { getEnumValues } from '@/components/types.server'
import TrackManager, { TrackLevel, TrackType } from '@/server/managers/track.manager'
import type { Actions, PageServerLoad } from './$types'

export const load = (async ({ locals }) => {
  if (!locals.user) throw new Error('Unauthorized')
  return {
    user: locals.user,
    tracks: TrackManager.getAll(),
    trackLevelColors: TrackManager.TrackLevelColors,
    allTrackTypes: getEnumValues(TrackType).map(t => {
      const lookup: LookupEntity = { id: t, featured: false, label: t }
      return lookup
    }),
    allTrackLevels: getEnumValues(TrackLevel).map(l => {
      const lookup: LookupEntity = { id: l, featured: false, label: l }
      return lookup
    }),
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
  update: async ({ request, locals }) => {
    if (!locals.user) throw new Error('Unauthorized')
    if (locals.user.role !== 'admin') throw new Error('Forbidden')

    return {
      track: await TrackManager.update(await request.formData()),
    }
  },
  delete: async ({ request, locals }) => {
    if (!locals.user) throw new Error('Unauthorized')
    if (locals.user.role !== 'admin') throw new Error('Forbidden')

    const form = await request.formData()
    await TrackManager.delete(form.get('id') as string)
  },
} satisfies Actions
