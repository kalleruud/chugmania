import type { QueuedEntry } from '@common/models/activeEntry'
import { getUserFullName } from '@common/models/user'
import { getSessionQueue } from '@common/utils/activeEntry'
import MatchSource from '../../database/sources/match.source'
import TimeEntrySource from '../../database/sources/timeEntry.source'
import UserSource from '../../database/sources/user.source'
import type { StartEvent } from '../models/webhook.generated'
import ActiveEntryManager from './activeEntry.manager'
import TournamentManager from './tournament/tournament.manager'

function normalize(name: unknown): string | undefined {
  if (typeof name === 'string')
    return name.trim().normalize('NFC').toLowerCase() || undefined
}

export function findPlannedEntry(
  session: string,
  track: string,
  players: StartEvent['players']
): { candidate: QueuedEntry; users: string[] } | undefined {
  const names = UserSource.getActiveNames().map(user => ({
    id: user.id,
    aliases: [normalize(user.shortName), normalize(getUserFullName(user))],
  }))
  const users: string[] = []
  for (const player of players) {
    const aliases = [normalize(player.name), normalize(player.login)].filter(
      alias => alias !== undefined
    )
    const matches = names.filter(user =>
      aliases.some(alias => user.aliases.includes(alias))
    )
    if (matches.length !== 1 || users.includes(matches[0].id)) return
    users.push(matches[0].id)
  }

  const tournament = TournamentManager.getDetails(session) ?? undefined
  const ready =
    tournament?.status === 'started' && !tournament.notReadyReason
      ? tournament
      : undefined
  const { now, next } = getSessionQueue(
    session,
    [...MatchSource.getStandaloneBySession(session), ...(ready?.matches ?? [])],
    TimeEntrySource.getAllBySession(session),
    ready,
    ActiveEntryManager.getOverrides()[session]
  )
  const candidate = [now, ...next].find(item => {
    if (!item) return false
    const { entry } = item
    if (
      entry.status !== 'planned' ||
      entry.webhookCapture ||
      entry.track !== track
    )
      return false
    if (item.kind === 'timeEntry')
      return (
        users.length === 1 &&
        item.entry.user === users[0] &&
        (!item.entry.tieBreaker ||
          ready?.tieBreakers.some(lap => lap.id === entry.id))
      )
    const { user1, user2, tournament } = item.entry
    return (
      !tournament?.readOnly &&
      users.length === 2 &&
      !!user1 &&
      !!user2 &&
      user1 !== user2 &&
      users.includes(user1) &&
      users.includes(user2)
    )
  })
  if (candidate) return { candidate, users }
}
