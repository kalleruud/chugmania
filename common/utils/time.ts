export function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = Math.floor(ms % 1000)

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

export function inputListToMs(digits: string[]) {
  const minutes = Number(
    digits
      .slice(0, 2)
      .map(d => d || '0')
      .join('')
  )
  const seconds = Number(
    digits
      .slice(2, 4)
      .map(d => d || '0')
      .join('')
  )
  const milliseconds = Number(
    digits
      .slice(4, 7)
      .map(d => d || '0')
      .join('')
  )
  return minutes * 60_000 + seconds * 1000 + milliseconds
}

function toStringOrEmpty(duration: number | null | undefined) {
  return duration && duration > 0 ? duration.toString() : ''
}

export function durationToInputList(
  duration: number | null | undefined
): string[] {
  if (!duration || duration <= 0) {
    return new Array<string>(7).fill('')
  }

  const minutes = Math.floor(duration / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)
  const milliseconds = Math.floor(duration % 1000)

  const tenMinutes = Math.floor(minutes / 10)
  const onesMinutes = minutes % 10

  const tenSeconds = Math.floor(seconds / 10)
  const onesSeconds = seconds % 10

  return [
    toStringOrEmpty(tenMinutes),
    toStringOrEmpty(onesMinutes),
    toStringOrEmpty(tenSeconds),
    toStringOrEmpty(onesSeconds),
    toStringOrEmpty(Math.floor(milliseconds / 100)),
    toStringOrEmpty(Math.floor((milliseconds % 100) / 10)),
    toStringOrEmpty(milliseconds % 10),
  ]
}
