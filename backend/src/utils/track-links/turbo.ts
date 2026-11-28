import loc from '@common/locale/locales'
import type { Platform } from '@common/models/track'
import { tryCatchAsync } from '@common/utils/try-catch'
import type { TrackLevel } from '../../../database/schema'
import {
  notFound,
  request,
  unsupported,
  type TrackLinkFetcher,
  type TrackMetadata,
} from './track-link'

const CAMPAIGN_LEVELS: TrackLevel[] = ['white', 'green', 'blue', 'red', 'black']
const TRACKS_PER_LEVEL = 40
const ENVIRONMENTS = ['Canyon', 'Valley', 'Lagoon', 'Stadium']
const PLATFORMS: Platform[] = ['pc', 'ps4', 'xb1']

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decode(text: string): string {
  return text.replaceAll(/&(#x?[\da-f]+|\w+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x'))
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
    if (entity.startsWith('#'))
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

function meta(html: string, property: string): string | undefined {
  const pattern = new RegExp(
    `<meta\\s+property="${property}"\\s+content="([^"]*)"`,
    'i'
  )
  const content = pattern.exec(html)?.[1]
  return content === undefined ? undefined : decode(content)
}

function detail(html: string, label: string): string | undefined {
  const pattern = new RegExp(`${label}(?:&nbsp;|\\s)*<strong>([^<]*)</strong>`)
  return pattern.exec(html)?.[1]?.trim()
}

function medalMs(html: string, medal: string): number | null {
  const pattern = new RegExp(
    `alt="${medal}_medal_icon"\\s*/?>\\s*<strong>([\\d:.]+)</strong>`
  )
  const time = pattern.exec(html)?.[1]
  if (!time) return null
  const seconds = time
    .split(':')
    .reduce((total, part) => total * 60 + Number(part), 0)
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null
}

function campaignLevel(number: number): TrackLevel {
  return (
    CAMPAIGN_LEVELS[Math.floor((number - 1) / TRACKS_PER_LEVEL)] ?? 'custom'
  )
}

export function parseTurboMap(
  html: string,
  uid: string,
  platform: Platform
): TrackMetadata | undefined {
  const title = /Track #(\d+) by (.+)$/.exec(meta(html, 'og:title') ?? '')
  if (!title) return undefined
  const number = Number(title[1])
  const description = meta(html, 'og:description') ?? ''
  const environment = ENVIRONMENTS.find(env =>
    description.includes(`${env} track`)
  )
  const isCampaign = detail(html, 'Style') === 'Campaign'
  return {
    game: 'turbo',
    platform,
    level: isCampaign ? campaignLevel(number) : 'custom',
    uid,
    name: String(number).padStart(3, '0'),
    author: title[2].trim(),
    environment: environment ?? null,
    authorMedalMs: medalMs(html, 'author'),
    goldMedalMs: medalMs(html, 'gold'),
    silverMedalMs: medalMs(html, 'silver'),
    bronzeMedalMs: medalMs(html, 'bronze'),
    isLaps: detail(html, 'Duration') === 'Multi-lap',
  }
}

const turbo: TrackLinkFetcher = {
  hosts: ['players.turbo.trackmania.com'],
  async fetch(url) {
    const match = /^\/(\w+)\/maps\/([\w-]+)\/?$/.exec(url.pathname)
    const platform = PLATFORMS.find(p => p === match?.[1])
    const uid = match?.[2]
    if (!platform || !uid) throw unsupported()
    const response = await request(
      `https://players.turbo.trackmania.com/${platform}/maps/${uid}`,
      { redirect: 'manual' }
    )
    if (!response) throw notFound()
    const { data: html, error } = await tryCatchAsync(response.text())
    if (error) throw new Error(loc.no.tracks.import.fetchFailed)
    const map = parseTurboMap(html, uid, platform)
    if (!map) throw notFound()
    return map
  },
}

export default turbo
