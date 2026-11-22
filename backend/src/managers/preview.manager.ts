import loc from '@common/locale/locales'
import { isDatePollOpen, type SessionWithSignups } from '@common/models/session'
import type { Track } from '@common/models/track'
import { getUserFullName, type User } from '@common/models/user'
import {
  formatDateWithYear,
  formatTimeOnly,
  isOngoing,
  isPast,
} from '@common/utils/date'
import { formatTime } from '@common/utils/time'
import { tryCatchAsync } from '@common/utils/try-catch'
import { createHash } from 'node:crypto'
import type { TrackLevel } from '../../database/schema'
import TimeEntrySource from '../../database/sources/timeEntry.source'
import TrackSource from '../../database/sources/track.source'
import UserSource from '../../database/sources/user.source'
import {
  PREVIEW_IMAGE_HEIGHT,
  PREVIEW_IMAGE_WIDTH,
  renderPreviewImage,
  type PreviewBadge,
  type PreviewCard,
} from '../utils/preview-image'
import RatingManager from './rating.manager'
import SessionManager from './session.manager'

export type PagePreview = {
  title: string
  description: string
  card: PreviewCard
}

const IMAGE_ROUTE = '/api/preview'
const MAX_DESCRIPTION_LENGTH = 280
const MAX_CACHED_IMAGES = 100

const levelColors: Record<TrackLevel, string> = {
  white: '#f5f5f5',
  green: '#22c55e',
  blue: '#3b82f6',
  red: '#ef4444',
  black: '#0a0a0a',
  custom: '#E53905',
}

const listPages: Partial<
  Record<string, { title: string; description: string }>
> = {
  sessions: loc.no.session,
  tracks: loc.no.tracks,
  users: loc.no.users,
  chugs: loc.no.chugs,
  admin: loc.no.admin,
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function truncate(value: string, length: number): string {
  const text = value.replaceAll(/\s+/g, ' ').trim()
  if (text.length <= length) return text
  return text.slice(0, length - 1).trimEnd() + '…'
}

function toPlainText(markdown: string): string {
  return markdown
    .replaceAll(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/^\s*(?:#+|>|[-*+]|\d+\.)\s+/gm, '')
    .replaceAll(/[*`~]/g, '')
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getDefaultPreview(): PagePreview {
  return {
    title: loc.no.chugmania,
    description: loc.no.preview.description,
    card: {
      kind: loc.no.chugmania,
      title: loc.no.chugmania,
      lines: [loc.no.preview.description],
      badges: [],
    },
  }
}

function getSessionStatus(session: SessionWithSignups): string {
  if (session.status === 'cancelled')
    return loc.no.session.statusOptions.cancelled
  if (isDatePollOpen(session)) return loc.no.session.datePoll.edit
  if (isPast(session)) return loc.no.session.status.past
  if (isOngoing(session)) return loc.no.session.status.ongoing
  if (session.status === 'tentative')
    return loc.no.session.statusOptions.tentative
  return loc.no.session.status.upcoming
}

function getSessionPreview(session: SessionWithSignups): PagePreview {
  const signups = session.signups.filter(s => s.response === 'yes').length
  const date = session.date
    ? capitalize(
        `${formatDateWithYear(session.date)} kl. ${formatTimeOnly(session.date)}`
      )
    : undefined
  const lines = [date, session.location?.trim()].filter(
    (line): line is string => !!line
  )
  const details = [...lines, loc.no.preview.signups(signups)].join(' · ')
  const description = toPlainText(session.description ?? '').trim()

  return {
    title: session.name,
    description: truncate(
      description ? `${details}. ${description}` : details,
      MAX_DESCRIPTION_LENGTH
    ),
    card: {
      kind: loc.no.preview.kind.session,
      title: session.name,
      lines,
      badges: [
        { label: getSessionStatus(session), primary: true },
        { label: loc.no.preview.signups(signups) },
      ],
    },
  }
}

function getHolderName(user: User): string {
  return user.shortName ?? getUserFullName(user)
}

function getTrackPreview(track: Track): PagePreview {
  const record = TimeEntrySource.findTrackRecord(track.id)
  const drivers = TimeEntrySource.countTrackDrivers(track.id)
  const recordLabel = record
    ? loc.no.preview.record(
        formatTime(record.duration, true),
        getHolderName(record.user)
      )
    : loc.no.preview.noRecord
  const lines = [
    [loc.no.preview.game[track.game], track.environment]
      .filter(Boolean)
      .join(' · '),
    track.author ? loc.no.preview.author(track.author) : undefined,
  ].filter((line): line is string => !!line)
  const badges: PreviewBadge[] = [
    { label: recordLabel, primary: true },
    { label: loc.no.preview.drivers(drivers) },
  ]
  if (track.level)
    badges.push({
      label: loc.no.tracks.level[track.level],
      dot: levelColors[track.level],
    })

  return {
    title: `#${track.name}`,
    description: [recordLabel, loc.no.preview.drivers(drivers), ...lines].join(
      ' · '
    ),
    card: {
      kind: loc.no.preview.kind.track,
      titlePrefix: '#',
      title: track.name,
      lines,
      badges,
    },
  }
}

function getUserPreview(user: User): PagePreview {
  const name = getUserFullName(user)
  const ranking = RatingManager.getUserRatings(user.id)?.ranking
  const joined = `${loc.no.user.joined} ${user.createdAt.getFullYear()}`
  const badges: PreviewBadge[] = []
  if (ranking)
    badges.push({ label: loc.no.preview.ranking(ranking), primary: true })
  if (user.shortName) badges.push({ label: user.shortName })

  return {
    title: name,
    description: [ranking ? loc.no.preview.ranking(ranking) : undefined, joined]
      .filter(Boolean)
      .join(' · '),
    card: {
      kind: loc.no.preview.kind.user,
      title: name,
      lines: [joined],
      badges,
    },
  }
}

function toSegments(pathname: string): string[] {
  return pathname
    .split('/')
    .filter(Boolean)
    .map(segment => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
}

async function resolvePreview(
  pathname: string
): Promise<PagePreview | undefined> {
  const [page, id] = toSegments(pathname)
  if (!page) return getDefaultPreview()

  if (!id) {
    const listPage = listPages[page]
    if (!listPage) return undefined
    return {
      title: listPage.title,
      description: listPage.description,
      card: {
        kind: loc.no.chugmania,
        title: listPage.title,
        lines: [listPage.description],
        badges: [],
      },
    }
  }

  switch (page) {
    case 'sessions': {
      const session = await SessionManager.getSession(id)
      return session ? getSessionPreview(session) : undefined
    }
    case 'tracks': {
      const track = TrackSource.getActiveById(id)
      return track ? getTrackPreview(track) : undefined
    }
    case 'users': {
      const user = UserSource.getActiveById(id)
      return user ? getUserPreview(user) : undefined
    }
    default:
      return undefined
  }
}

export default class PreviewManager {
  private static readonly images = new Map<string, Buffer>()

  static async getPreview(pathname: string): Promise<PagePreview> {
    const { data, error } = await tryCatchAsync(resolvePreview(pathname))
    if (error)
      console.error(
        new Date().toISOString(),
        `Failed to resolve preview for '${pathname}'`,
        error
      )
    return data ?? getDefaultPreview()
  }

  static async getImage(pathname: string): Promise<Buffer> {
    const { card } = await PreviewManager.getPreview(pathname)
    const key = PreviewManager.getCardKey(card)
    const cached = PreviewManager.images.get(key)
    if (cached) return cached

    const image = await renderPreviewImage(card)
    if (PreviewManager.images.size >= MAX_CACHED_IMAGES) {
      const oldest = PreviewManager.images.keys().next().value
      if (oldest !== undefined) PreviewManager.images.delete(oldest)
    }
    PreviewManager.images.set(key, image)
    return image
  }

  static toImagePath(pathname: string): string {
    const segments = toSegments(pathname).map(encodeURIComponent)
    const page = segments.length > 0 ? segments.join('/') : 'index'
    return `${IMAGE_ROUTE}/${page}.png`
  }

  static fromImagePath(segments: string[]): string {
    const page = segments.join('/').replace(/\.png$/, '')
    return page === 'index' ? '/' : `/${page}`
  }

  static async injectMeta(
    html: string,
    pathname: string,
    origin: URL
  ): Promise<string> {
    const preview = await PreviewManager.getPreview(pathname)
    const pageUrl = new URL(pathname, origin)
    const imageUrl = new URL(PreviewManager.toImagePath(pathname), origin)
    imageUrl.searchParams.set('v', PreviewManager.getCardKey(preview.card))

    const properties: [string, string][] = [
      ['og:site_name', loc.no.chugmania],
      ['og:type', 'website'],
      ['og:locale', 'nb_NO'],
      ['og:url', pageUrl.toString()],
      ['og:title', preview.title],
      ['og:description', preview.description],
      ['og:image', imageUrl.toString()],
      ['og:image:type', 'image/png'],
      ['og:image:width', String(PREVIEW_IMAGE_WIDTH)],
      ['og:image:height', String(PREVIEW_IMAGE_HEIGHT)],
      ['og:image:alt', loc.no.preview.imageAlt(preview.title)],
    ]
    const names: [string, string][] = [
      ['description', preview.description],
      ['twitter:card', 'summary_large_image'],
      ['twitter:title', preview.title],
      ['twitter:description', preview.description],
      ['twitter:image', imageUrl.toString()],
    ]
    const tags = [
      ...properties.map(
        ([key, value]) =>
          `<meta property="${key}" content="${escapeHtml(value)}" />`
      ),
      ...names.map(
        ([key, value]) =>
          `<meta name="${key}" content="${escapeHtml(value)}" />`
      ),
    ]
    return html.replace(
      '</head>',
      () => `    ${tags.join('\n    ')}\n  </head>`
    )
  }

  private static getCardKey(card: PreviewCard): string {
    return createHash('sha1')
      .update(JSON.stringify(card))
      .digest('hex')
      .slice(0, 12)
  }
}
