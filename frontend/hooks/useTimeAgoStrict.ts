import loc from '@/lib/locales'
import { isOngoing, isPast } from '@common/utils/date'
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
  const parsedDate = new Date(date)
  const [formattedDistance, setFormattedDistance] = useState(
    getString(parsedDate)
  )

  useEffect(() => {
    const interval = setInterval(() => {
      const newString = getString(parsedDate)

      // Only trigger re-render if the string changed
      if (newString !== formattedDistance) {
        setFormattedDistance(newString)
      }
    }, updateInterval)

    return () => clearInterval(interval)
  }, [])

  return formattedDistance
}

function getString(date: Date) {
  if (isOngoing({ date })) return loc.no.common.now
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: nb,
    roundingMethod: isPast({ date }) ? 'floor' : 'ceil',
  })
}
