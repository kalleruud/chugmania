export function formatTime(ms: number, truncate = false): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = Math.floor(ms % 1000)
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
  if (truncate) return formatted.replace(/^00:/, '').replace(/^0/, '')
  return formatted
}

export function inputListToMs(digits: string[]): number {
  const values = digits.map(digit => Number.parseInt(digit || '0'))
  return (
    (values[0] * 10 + values[1]) * 60000 +
    (values[2] * 10 + values[3]) * 1000 +
    values[4] * 100 +
    values[5] * 10 +
    (values[6] ?? 0)
  )
}

export function durationToInputList(
  duration: number | null | undefined
): string[] {
  if (!duration || duration <= 0) return new Array<string>(7).fill('')
  return formatTime(duration)
    .replace(/[:.]/g, '')
    .split('')
    .map(digit => (digit === '0' ? '' : digit))
}
