import loc from '@/lib/locales'
import { isPast, isUpcoming } from '@common/utils/date'
import { formatDistanceToNowStrict as formatDistanceToNow } from 'date-fns'
import { nb } from 'date-fns/locale'
import { useEffect, useState } from 'react'

interface UseTimeAgoStrictProps {
  date: Date | string
  updateInterval?: number // ms between checks (default: 1000)
}

/**
 * Hook to display relative time using formatDistanceToNowStrict.
 * Only triggers re-renders when the formatted string actually changes.
 * Automatically cleans up the interval on unmount.
 *
 * @param date - Date object or ISO string to format
 * @param updateInterval - Milliseconds between checks (default: 1000)
 * @returns Formatted relative time string (e.g., "in 2 hours", "2 hours ago")
 */
export function useTimeAgoStrict({
  date,
  updateInterval = 1000,
}: UseTimeAgoStrictProps): string {
  const timestamp = new Date(date).getTime()
  const [formattedDistance, setFormattedDistance] = useState(() =>
    getString(new Date(timestamp))
  )

  useEffect(() => {
    const interval = setInterval(() => {
      const parsedDate = new Date(timestamp)
      const newString = getString(parsedDate)
      setFormattedDistance(current =>
        newString === current ? current : newString
      )
    }, updateInterval)

    return () => clearInterval(interval)
  }, [timestamp, updateInterval])

  return formattedDistance
}

function getString(date: Date) {
  if (!isPast({ date }) && !isUpcoming({ date })) return loc.no.common.now
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: nb,
    roundingMethod: isPast({ date }) ? 'floor' : 'ceil',
  })
}
