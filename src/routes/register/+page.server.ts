import type { LookupEntity } from '@/components/lookup/lookup.server'
import type { timeEntries } from '@/server/db/schema'
import SessionManager from '@/server/managers/session.manager'
import TimeEntryManager from '@/server/managers/timeEntry.manager'
import TrackManager from '@/server/managers/track.manager'
import UserManager, { type PublicUser } from '@/server/managers/user.manager'
import { type Actions } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load = (async ({ locals }) => {
  if (!locals.user) throw new Error('Unauthorized')
  const { user } = locals

  const mostRecentSession = await SessionManager.getMostRecent()
  const mostRecentTimeEntry = await TimeEntryManager.getMostRecent()

  const allUsers: LookupEntity[] = await UserManager.getAllLookup()
  const allSessions: LookupEntity[] = await SessionManager.getAllLookup()
  const allTracks: LookupEntity[] = await TrackManager.getAllLookup()

  return { user, allUsers, allTracks, allSessions, mostRecentSession, mostRecentTimeEntry }
}) satisfies PageServerLoad

export const actions = {
  add: async ({ request, locals }) => {
    if (!locals.user) throw new Error('Unauthorized')

    console.log('Registering new time')
    const data = await parseFields(await request.formData(), locals.user)
    const entry = await TimeEntryManager.create(data)

    return { success: true, entry }
  },
} satisfies Actions

async function parseFields(data: FormData, user: PublicUser) {
  let minutes = data.get('minutes')?.toString() ?? ''
  minutes = minutes?.length === 0 ? '0' : minutes

  let seconds = data.get('seconds')?.toString() ?? ''
  seconds = seconds?.length === 0 ? '0' : seconds

  let houndredths = data.get('houndredths')?.toString() ?? ''
  houndredths = houndredths?.length === 0 ? '0' : houndredths

  const duration = TimeEntryManager.toMs(
    Number.parseInt(minutes),
    Number.parseInt(seconds),
    Number.parseInt(houndredths)
  )

  const dateString = data.get('date') as string
  console.log('dateString:', dateString)

  const session =
    (await SessionManager.getFromDate(dateString)) ??
    (await SessionManager.create('practice', user))
  const comment = data.get('comment')?.toString()

  return {
    duration,
    track: data.get('track') as string,
    session: session.id,
    user: data.get('user') as string,
    comment: comment?.length ? comment : undefined,
    amount: 0.5,
  } satisfies typeof timeEntries.$inferInsert
}
