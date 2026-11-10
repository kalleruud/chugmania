const entryStatuses = [
  'planned',
  'in_progress',
  'draft',
  'completed',
  'cancelled',
] as const

export type EntryStatus = (typeof entryStatuses)[number]

export function isEntryStatus(value: unknown): value is EntryStatus {
  return entryStatuses.some(status => status === value)
}
