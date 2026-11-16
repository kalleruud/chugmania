export type ChugMode = 'average' | 'best'

export type ChugTime = {
  user: string
  durationMs: number
}

export type ChugTimes = Record<ChugMode, ChugTime[]>
