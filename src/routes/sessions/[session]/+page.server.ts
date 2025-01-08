import SessionManager from '@/server/managers/session.manager'
import TimeEntryManager, { type TimeEntry } from '@/server/managers/timeEntry.manager'
import { type Track } from '@/server/managers/track.manager'
import { redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load = (async ({ params, locals }) => {
  if (!locals.user) throw new Error('Unauthorized')

  const session = await SessionManager.get(params.session)
  const timeEntries = await TimeEntryManager.getBySession(session.id)

  const sessionData = timeEntries.reduce((acc, entry) => {
    const i = acc.findIndex(x => x.track.id === entry.track.id)
    if (i === -1) acc.push({ track: entry.track, entries: [entry] })
    else acc[i].entries.push(entry)
    return acc
  }, new Array<{ track: Track; entries: TimeEntry[] }>())

  sessionData.forEach(({ track, entries }, i) => {
    sessionData[i] = { track, entries: TimeEntryManager.getDurationGaps(entries) }
  })

  return { user: locals.user, session, sessionData }
}) satisfies PageServerLoad

export const actions = {
  update: async ({ request, locals, params }) => {
    if (!locals.user) throw new Error('Unauthorized')
    if (locals.user.role !== 'admin') throw new Error('Forbidden')
    const form = await request.formData()
    const description = form.get('title') as string

    await SessionManager.update(params.session, description.length > 0 ? description : null)
  },
  delete: async ({ locals, params }) => {
    if (!locals.user) throw new Error('Unauthorized')
    if (locals.user.role !== 'admin') throw new Error('Forbidden')
    await SessionManager.delete(params.session)
    throw redirect(303, '/sessions')
  },
} satisfies Actions
