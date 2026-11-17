import { useData } from '@/contexts/DataContext'
import type { EntryKind, QueuedEntry } from '@common/models/activeEntry'

export function useActiveEntries() {
  const { activeEntryQueues: queues } = useData()

  function getNow(kind: EntryKind, id: string): QueuedEntry | undefined {
    for (const { now } of queues.values())
      if (now?.kind === kind && now.entry.id === id) return now
    return undefined
  }

  return { queues, getNow }
}
