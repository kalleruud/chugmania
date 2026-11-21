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
  const time = new Date(date).getTime()
  const [formattedDistance, setFormattedDistance] = useState(
    getString(new Date(time))
  )

  useEffect(() => {
    const update = () => setFormattedDistance(getString(new Date(time)))
    update()
    const interval = setInterval(update, updateInterval)

    return () => clearInterval(interval)
  }, [time, updateInterval])

  return formattedDistance
}

function getString(date: Date) {
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: nb,
    roundingMethod: date < new Date() ? 'floor' : 'ceil',
  })
}
