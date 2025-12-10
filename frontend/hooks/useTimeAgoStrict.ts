import { formatDistanceToNowStrict } from 'date-fns'
import { nb } from 'date-fns/locale'
import { useEffect, useRef, useState } from 'react'

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
  const parsedDate = typeof date === 'string' ? new Date(date) : date
  const [, setForceUpdate] = useState(0)
  const previousStringRef = useRef<string>('')

  // Initialize with the current formatted string
  if (!previousStringRef.current) {
    previousStringRef.current = formatDistanceToNowStrict(parsedDate, {
      addSuffix: true,
      locale: nb,
    })
  }

  useEffect(() => {
    const interval = setInterval(() => {
      const newString = formatDistanceToNowStrict(parsedDate, {
        addSuffix: true,
        locale: nb,
      })

      // Only trigger re-render if the string changed
      if (newString !== previousStringRef.current) {
        previousStringRef.current = newString
        setForceUpdate(prev => prev + 1)
      }
    }, updateInterval)

    return () => clearInterval(interval)
  }, [parsedDate, updateInterval])

  return previousStringRef.current
}
