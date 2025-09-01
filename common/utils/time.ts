export function parseLapTime(input: string): number {
  // Accept formats like m:ss.cc or mm:ss.cc or s.cc
  const trimmed = input.trim()
  const re = /^(?:(\d+):)?([0-5]?\d)\.(\d{2})$/
  const m = re.exec(trimmed)
  if (!m) throw new Error('Format must be m:ss.cc (e.g. 1:23.45)')
  const minutes = m[1] ? parseInt(m[1]!, 10) : 0
  const seconds = parseInt(m[2]!, 10)
  const centis = parseInt(m[3]!, 10)
  if (seconds >= 60) throw new Error('Seconds must be < 60')
  return minutes * 60_000 + seconds * 1_000 + centis * 10
}

export function formatLapTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centis = Math.floor((ms % 1000) / 10)
  const s = seconds.toString().padStart(2, '0')
  const c = centis.toString().padStart(2, '0')
  return `${minutes}:${s}.${c}`
}
