import loc from '@common/locale/locales'
import type { TimeEntry } from '@common/models/timeEntry'
import type { Track } from '@common/models/track'
import { formatTime } from '@common/utils/time'
import type { Grouping } from '../grouped-list/grouping'

export type Medal = 'author' | 'gold' | 'silver' | 'bronze'

const MEDALS: Medal[] = ['author', 'gold', 'silver', 'bronze']
const NO_MEDAL = 'none'

export function medalTimes(track: Track): [Medal, number][] {
  const times: [Medal, number | null][] = [
    ['author', track.authorMedalMs],
    ['gold', track.goldMedalMs],
    ['silver', track.silverMedalMs],
    ['bronze', track.bronzeMedalMs],
  ]
  return times.filter((time): time is [Medal, number] => (time[1] ?? 0) > 0)
}

export function formatMedalTime(ms: number): string {
  return formatTime(ms).replace(/^0/, '')
}

export function medalIcon(medal: Medal): string {
  return `/medals/${medal}.svg`
}

function toMedal(key: string): Medal | undefined {
  return MEDALS.find(medal => medal === key)
}

function medalRank(key: string): number {
  const medal = toMedal(key)
  return medal ? MEDALS.indexOf(medal) : MEDALS.length
}

export function hasMedalTimes(track: Track): boolean {
  return medalTimes(track).length > 0
}

export function byMedal(track: Track): Grouping<TimeEntry> {
  const medals = medalTimes(track)
  return {
    key: entry => {
      const { duration } = entry
      if (entry.status !== 'completed' || !duration) return NO_MEDAL
      return medals.find(([, ms]) => duration <= ms)?.[0] ?? NO_MEDAL
    },
    label: key => loc.no.timeEntry.medals[toMedal(key) ?? NO_MEDAL],
    icon: key => {
      const medal = toMedal(key)
      return medal && medalIcon(medal)
    },
    description: key => {
      const time = medals.find(([medal]) => medal === key)?.[1]
      return time === undefined ? undefined : formatMedalTime(time)
    },
    compare: (a, b) => medalRank(a) - medalRank(b),
  }
}
