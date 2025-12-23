import type { SessionWithSignups } from '@common/models/session'
import type { Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import { formatDateWithYear } from '@common/utils/date'
import { formatTrackName } from '@common/utils/track'

export function trackToLookupItem(track: Track) {
  const trackName = '#' + formatTrackName(track.number)
  return {
    ...track,
    label: trackName,
    sublabel: `${track.level} • ${track.type}`,
    tags: [track.level, track.type, trackName],
  }
}

export function sessionToLookupItem(session: SessionWithSignups) {
  const formattedDate = formatDateWithYear(session.date)
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
    tags: [
      user.firstName,
      user.lastName ?? '',
      user.shortName ?? '',
      user.email ?? '',
    ],
  }
}

export function getId(path: string) {
  const id = path.split('/').at(-1)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return id && uuidRegex.test(id) ? id : undefined
}
