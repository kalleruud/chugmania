import loc from '@common/locale/locales'
import type { SessionWithSignups } from '@common/models/session'
import { getTrackName, type Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import { formatDateWithYear } from '@common/utils/date'

export function trackToLookupItem(track: Track) {
  const trackName = '#' + getTrackName(track)
  const realName = track.nickname ? '#' + track.name : null
  const details = [track.level, track.environment, track.mapType].filter(
    (value): value is string => value !== null
  )
  return {
    ...track,
    label: trackName,
    sublabel: [realName, ...details].filter(Boolean).join(' • '),
    tags: [...details, trackName, realName ?? ''],
  }
}

export function sessionToLookupItem(session: SessionWithSignups) {
  const formattedDate = session.date
    ? formatDateWithYear(session.date)
    : loc.no.session.datePoll.pendingDate
  return {
    ...session,
    label: session.name,
    sublabel: formattedDate,
    tags: [session.name, formattedDate, session.status, session.location ?? ''],
    value: session.id,
  }
}

export function userToLookupItem(user: UserInfo) {
  return {
    ...user,
    label: user.firstName + (user.lastName ? ' ' + user.lastName : ''),
    sublabel: user.shortName,
    tags: [user.firstName, user.lastName ?? '', user.shortName, user.email],
  }
}

export function getId(path: string) {
  const id = path.split('/').at(-1)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return id && uuidRegex.test(id) ? id : undefined
}
