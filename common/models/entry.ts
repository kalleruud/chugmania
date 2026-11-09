export type EntryStatus =
  | 'planned'
  | 'in_progress'
  | 'draft'
  | 'completed'
  | 'cancelled'

export function isEntryStatus(value: unknown): value is EntryStatus {
  return (
    value === 'planned' ||
    value === 'in_progress' ||
    value === 'draft' ||
    value === 'completed' ||
    value === 'cancelled'
  )
}
