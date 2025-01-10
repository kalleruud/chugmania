import GroupManager from '@/server/managers/group.manager'
import MatchManager from '@/server/managers/match.manager'
import SessionManager from '@/server/managers/session.manager'
import TimeEntryManager, { type TimeEntry } from '@/server/managers/timeEntry.manager'
import TournamentManager from '@/server/managers/tournament.manager'
import TrackManager, { type Track } from '@/server/managers/track.manager'
import UserManager from '@/server/managers/user.manager'
import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

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

  return {
    loggedInUser: locals.user,
    session,
    tracksWithEntries,
    groups: await GroupManager.getAllFromSession(session.id),
    matches: await MatchManager.getAllFromSession(session.id),
    userLookup: await UserManager.getAllLookup(),
  }
}) satisfies PageServerLoad

export const actions = {
  update: async ({ request, locals, params }) => {
    if (!locals.user) return fail(401, { message: 'Unauthorized' })
    if (locals.user.role !== 'admin') return fail(403, { message: 'Forbidden' })
    const form = await request.formData()
    const description = form.get('title') as string
    const date = form.get('date') as string

    await SessionManager.update(params.session, description.length > 0 ? description : null, date)
  },
  delete: async ({ locals, params }) => {
    if (!locals.user) return fail(401, { message: 'Unauthorized' })
    if (locals.user.role !== 'admin') return fail(403, { message: 'Forbidden' })
    await SessionManager.delete(params.session)
    throw redirect(303, '/sessions')
  },
  generateGroups: async ({ locals, params }) => {
    if (!locals.user) return fail(401, { message: 'Unauthorized' })
    if (locals.user.role !== 'admin') return fail(403, { message: 'Forbidden' })

    const players = await UserManager.getAll()
    if (players.length < 4) return fail(400, { message: 'Not enough players' })
    await TournamentManager.clearGroups(params.session)
    await TournamentManager.generateGroups(params.session, players, 4)
  },
  scheduleMatches: async ({ locals, params }) => {
    if (!locals.user) return fail(401, { message: 'Unauthorized' })
    if (locals.user.role !== 'admin') return fail(403, { message: 'Forbidden' })

    await TournamentManager.clearMatches(params.session)
    const groups = await GroupManager.getAllFromSession(params.session)
    const tracks = await TrackManager.getAll()
    TournamentManager.generateMatchesForGroup(params.session, groups, tracks)
  },
  setWinner: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { message: 'Unauthorized' })
    if (locals.user.role === 'user') return fail(403, { message: 'Forbidden' })
    const form = await request.formData()

    const matchId = form.get('match') as string
    const winnerId = form.get('winner') as string
    const currentWinner = form.get('currentWinner') as string | undefined
    if (winnerId === currentWinner) {
      await MatchManager.setWinner(matchId, null)
    } else await MatchManager.setWinner(matchId, winnerId)
  },
} satisfies Actions
