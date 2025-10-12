export function formatTime(ms: number, truncate: boolean = false): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const hundredths = Math.floor((ms % 1000) / 10)

  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`

  if (truncate) return formatted.replace(/^00:/, '').replace(/^0/, '')
  return formatted
}

export function formattedTimeToMs(
  minutes: number,
  seconds: number,
  hundredths: number
) {
  return minutes * 60_000 + seconds * 1000 + hundredths * 10
}
