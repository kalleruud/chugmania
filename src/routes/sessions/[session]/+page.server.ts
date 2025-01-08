import SessionManager from '@/server/managers/session.manager'
import TimeEntryManager, { type TimeEntry } from '@/server/managers/timeEntry.manager'
import { type Track } from '@/server/managers/track.manager'
import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import GroupManager from '@/server/managers/group.manager'

export const load = (async ({ params, locals }) => {
  if (!locals.user) throw new Error('Unauthorized')

  const session = await SessionManager.get(params.session)
  const timeEntries = await TimeEntryManager.getBySession(session.id)

  const tracksWithEntries = timeEntries.reduce((acc, entry) => {
    const i = acc.findIndex(x => x.track.id === entry.track.id)
    if (i === -1) acc.push({ track: entry.track, entries: [entry] })
    else acc[i].entries.push(entry)
    return acc
  }, new Array<{ track: Track; entries: TimeEntry[] }>())

  tracksWithEntries.forEach(({ track, entries }, i) => {
    tracksWithEntries[i] = { track, entries: TimeEntryManager.getDurationGaps(entries) }
  })

  const groups = await GroupManager.getAllFromSession(session.id)

  return { user: locals.user, session, tracksWithEntries, groups }
}) satisfies PageServerLoad

export const actions = {
  update: async ({ request, locals, params }) => {
    if (!locals.user) return fail(401, { message: 'Unauthorized' })
    if (locals.user.role !== 'admin') return fail(403, { message: 'Forbidden' })
    const form = await request.formData()
    const description = form.get('title') as string

    await SessionManager.update(params.session, description.length > 0 ? description : null)
  },
  delete: async ({ locals, params }) => {
    if (!locals.user) return fail(401, { message: 'Unauthorized' })
    if (locals.user.role !== 'admin') return fail(403, { message: 'Forbidden' })
    await SessionManager.delete(params.session)
    throw redirect(303, '/sessions')
  },
  addGroup: async ({ locals, params }) => {
    if (!locals.user) return fail(401, { message: 'Unauthorized' })
    if (locals.user.role !== 'admin') return fail(403, { message: 'Forbidden' })

    await SessionManager.addGroup(params.session)
  },
  deleteGroup: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Unauthorized' })
    if (locals.user.role !== 'admin') return fail(403, { message: 'Forbidden' })
    const form = await request.formData()
    const id = form.get('id') as string
    await GroupManager.delete(id)
  },
} satisfies Actions
