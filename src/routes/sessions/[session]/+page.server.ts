import SessionManager from '@/server/managers/session.manager'
import type { PageServerLoad } from './$types'
import TimeEntryManager, { type TimeEntry } from '@/server/managers/timeEntry.manager'
import { type Track } from '@/server/managers/track.manager'

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

  return { session, sessionData }
}) satisfies PageServerLoad
