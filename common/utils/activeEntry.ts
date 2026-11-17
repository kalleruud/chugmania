import type { ActiveSource, EntryRef, QueuedEntry } from '../models/activeEntry'
import type { EntryStatus } from '../models/entry'
import type { Match } from '../models/match'
import type { TimeEntry } from '../models/timeEntry'
import type { TournamentDetails } from '../models/tournament'
import { isInactiveFinalReset } from './tournament'

type Entry = Match | TimeEntry

export type SessionQueue = {
  now: QueuedEntry | undefined
  next: QueuedEntry[]
}

export function isUnplayed(entry: Pick<Entry, 'status' | 'deletedAt'>) {
  return (
    !entry.deletedAt &&
    entry.status !== 'completed' &&
    entry.status !== 'cancelled'
  )
}

function time(date: Date | null | undefined): number {
  return date ? new Date(date).getTime() : 0
}

function byCreated(a: QueuedEntry, b: QueuedEntry): number {
  return (
    time(a.entry.createdAt) - time(b.entry.createdAt) ||
    a.entry.id.localeCompare(b.entry.id)
  )
}

function byLatestUpdate(a: QueuedEntry, b: QueuedEntry): number {
  return (
    time(b.entry.updatedAt ?? b.entry.createdAt) -
      time(a.entry.updatedAt ?? a.entry.createdAt) ||
    a.entry.id.localeCompare(b.entry.id)
  )
}

function queued(
  matches: Match[],
  timeEntries: TimeEntry[],
  source: ActiveSource
): QueuedEntry[] {
  return [
    ...matches.map((entry): QueuedEntry => ({ kind: 'match', entry, source })),
    ...timeEntries.map((entry): QueuedEntry => ({
      kind: 'timeEntry',
      entry,
      source,
    })),
  ]
}

function hasStatus(entry: Entry, statuses: EntryStatus[]): boolean {
  return !entry.deletedAt && statuses.includes(entry.status)
}

function webhookCandidates(
  matches: Match[],
  timeEntries: TimeEntry[]
): QueuedEntry[] {
  const isLive = (entry: Entry) =>
    hasStatus(entry, ['in_progress']) && !!entry.webhookCapture
  return queued(
    matches.filter(isLive),
    timeEntries.filter(isLive),
    'webhook'
  ).toSorted(byLatestUpdate)
}

function tournamentCandidates(
  tournament: TournamentDetails | undefined
): QueuedEntry[] {
  if (tournament?.status !== 'started' || tournament.cancelled) return []
  const playable = tournament.matches.filter(
    match =>
      hasStatus(match, ['planned']) &&
      !!match.user1 &&
      !!match.user2 &&
      !isInactiveFinalReset(match)
  )
  const laps = tournament.tieBreakers.filter(lap =>
    hasStatus(lap, ['planned', 'in_progress'])
  )
  const lapQueue = (required: boolean) =>
    queued(
      [],
      laps.filter(lap => lap.required === required),
      'tournament'
    ).toSorted(byCreated)
  return [
    ...queued(playable, [], 'tournament'),
    ...lapQueue(true),
    ...lapQueue(false),
  ]
}

function sessionCandidates(
  matches: Match[],
  timeEntries: TimeEntry[]
): QueuedEntry[] {
  const isOpen = (entry: Entry) => hasStatus(entry, ['planned', 'in_progress'])
  return queued(
    matches.filter(match => !match.tournament && isOpen(match)),
    timeEntries.filter(entry => !entry.tieBreaker && isOpen(entry)),
    'session'
  ).toSorted(byCreated)
}

function key(entry: Pick<QueuedEntry, 'kind'> & { id: string }): string {
  return `${entry.kind}:${entry.id}`
}

function findOverride(
  override: EntryRef | undefined,
  session: string,
  matches: Match[],
  timeEntries: TimeEntry[]
): QueuedEntry | undefined {
  if (!override) return undefined
  const found = queued(matches, timeEntries, 'override').find(
    candidate =>
      candidate.kind === override.kind && candidate.entry.id === override.id
  )
  if (!found || found.entry.session !== session || !isUnplayed(found.entry))
    return undefined
  return found
}

export function getSessionQueue(
  session: string,
  matches: Match[],
  timeEntries: TimeEntry[],
  tournament: TournamentDetails | undefined,
  override?: EntryRef
): SessionQueue {
  const sessionMatches = matches.filter(match => match.session === session)
  const sessionEntries = timeEntries.filter(entry => entry.session === session)
  const seen = new Set<string>()
  const queue = [
    ...webhookCandidates(sessionMatches, sessionEntries),
    ...tournamentCandidates(
      tournament?.config.session === session ? tournament : undefined
    ),
    ...sessionCandidates(sessionMatches, sessionEntries),
  ].filter(candidate => {
    const id = key({ kind: candidate.kind, id: candidate.entry.id })
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  const pinned = findOverride(override, session, sessionMatches, sessionEntries)
  const now = pinned ?? queue.at(0)
  const next = now
    ? queue.filter(
        candidate =>
          key({ kind: candidate.kind, id: candidate.entry.id }) !==
          key({ kind: now.kind, id: now.entry.id })
      )
    : []
  return { now, next }
}
