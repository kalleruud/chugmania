export function formatTime(ms: number, truncate: boolean = false): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const hundredths = Math.floor((ms % 1000) / 10)

  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`

  if (truncate) return formatted.replace(/^00:/, '').replace(/^0/, '')
  return formatted
}

function formattedTimeToMs(
  minutes: number,
  seconds: number,
  hundredths: number
) {
  return minutes * 60_000 + seconds * 1000 + hundredths * 10
}

export function inputListToMs(digits: string[]) {
  const tenMinutes = digits[0] === '' ? 0 : Number.parseInt(digits[0]) * 10
  const minutes = digits[1] === '' ? 0 : Number.parseInt(digits[1])

  const tenSeconds = digits[2] === '' ? 0 : Number.parseInt(digits[2]) * 10
  const seconds = digits[3] === '' ? 0 : Number.parseInt(digits[3])

  const tenHundredths = digits[4] === '' ? 0 : Number.parseInt(digits[4]) * 10
  const hundredths = digits[5] === '' ? 0 : Number.parseInt(digits[5])

  return formattedTimeToMs(
    tenMinutes + minutes,
    tenSeconds + seconds,
    tenHundredths + hundredths
  )
}

function toStringOrEmpty(duration: number | null | undefined) {
  return duration && duration > 0 ? duration.toString() : ''
}

export function durationToInputList(
  duration: number | null | undefined
): string[] {
  if (!duration || duration <= 0) {
    return new Array(6).fill('')
  }

  const minutes = Math.floor(duration / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)
  const hundredths = Math.floor((duration % 1000) / 10)

  const tenMinutes = Math.floor(minutes / 10)
  const onesMinutes = minutes % 10

  const tenSeconds = Math.floor(seconds / 10)
  const onesSeconds = seconds % 10

  const tenHundredths = Math.floor(hundredths / 10)
  const onesHundredths = hundredths % 10

  return [
    toStringOrEmpty(tenMinutes),
    toStringOrEmpty(onesMinutes),
    toStringOrEmpty(tenSeconds),
    toStringOrEmpty(onesSeconds),
    toStringOrEmpty(tenHundredths),
    toStringOrEmpty(onesHundredths),
  ]
}
