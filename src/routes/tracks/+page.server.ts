import TrackManager, { TrackLevel, TrackType } from '@/server/managers/track.manager'
import type { PageServerLoad } from './$types'
import { getEnumValues } from '@/components/types.server'
import type { LookupEntity } from '@/components/types.server'

export const load = (async ({ locals }) => {
  if (!locals.user) throw new Error('Unauthorized')
  return {
    tracks: TrackManager.getAll(),
    user: locals.user,
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
