import type { LookupEntity } from '@/components/track-lookup/track-grid.server'
import SessionManager from '@/server/managers/session.manager'
import TimeEntryManager from '@/server/managers/timeEntry.manager'
import TrackManager from '@/server/managers/track.manager'
import UserManager from '@/server/managers/user.manager'
import { type Actions } from '@sveltejs/kit'
import { handleError } from '../../hooks.server'
import type { PageServerLoad } from './$types'

export const load = (async ({ locals }) => {
  if (!locals.user) throw new Error('Unauthorized')
  const { user } = locals

  const allUsers: LookupEntity[] = await UserManager.getAllLookup()
  const mostRecentSession = await SessionManager.getMostRecent()
  const allSessions: LookupEntity[] = await SessionManager.getAllLookup()
  const allTracks: LookupEntity[] = await TrackManager.getAllLookup()

  return { user, allUsers, allTracks, allSessions, mostRecentSession }
}) satisfies PageServerLoad

export const actions = {
  add: async ({ request }) => {
    try {
      console.log('Registering new time')
      const data = parseFields(await request.formData())

      const entry = await TimeEntryManager.create({
        duration: data.duration,
        track: data.trackId,
        session: data.sessionId,
        user: data.userId,
        amount: 0.5,
      })

      return { success: true, entry }
    } catch (error) {
      handleError(error)
    }
  },
} satisfies Actions

function parseFields(data: FormData) {
  const minutes = data.get('minutes')?.toString()
  const seconds = data.get('seconds')?.toString()
  const houndreds = data.get('houndreds')?.toString()

  const duration = TimeEntryManager.toMs(
    Number.parseInt(minutes || '0'),
    Number.parseInt(seconds || '0'),
    Number.parseInt(houndreds || '0')
  )

  return {
    duration,
    trackId: data.get('track')!.toString(),
    sessionId: data.get('session')!.toString(),
    userId: data.get('user')!.toString(),
  }
}
