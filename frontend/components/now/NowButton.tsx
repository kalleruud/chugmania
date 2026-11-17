import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useActiveEntries } from '@/hooks/useActiveEntries'
import loc from '@common/locale/locales'
import type { EntryKind } from '@common/models/activeEntry'
import type { EntryStatus } from '@common/models/entry'
import { isUnplayed } from '@common/utils/activeEntry'
import { Pin, PinOff } from 'lucide-react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import { Button } from '../ui/button'

type NowButtonProps = {
  kind: EntryKind
  entry: {
    id: string
    session: string | null
    status: EntryStatus
    deletedAt: Date | null
  }
  className?: string
}

export default function NowButton({
  kind,
  entry,
  className,
}: Readonly<NowButtonProps>) {
  const { socket } = useConnection()
  const { isLoggedIn, loggedInUser } = useAuth()
  const { queues, getNow } = useActiveEntries()
  const session = entry.session
  const now = getNow(kind, entry.id)

  if (!isLoggedIn || loggedInUser.role === 'user' || !session) return null
  if (!queues.has(session) || !isUnplayed(entry)) return null
  if (now && now.source !== 'override') return null

  const pinned = now?.source === 'override'
  const label = pinned ? loc.no.activeEntry.clearNow : loc.no.activeEntry.setNow
  const Icon = pinned ? PinOff : Pin

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      aria-label={label}
      title={label}
      className={twMerge('size-7 shrink-0 text-muted-foreground', className)}
      onClick={event => {
        event.stopPropagation()
        toast.promise(
          socket
            .emitWithAck('set_active_entry', {
              type: 'SetActiveEntryRequest',
              session,
              entry: pinned ? null : { kind, id: entry.id },
            })
            .then(response => {
              if (!response.success) throw new Error(response.message)
            }),
          loc.no.activeEntry.toast
        )
      }}>
      <Icon className='size-4' />
    </Button>
  )
}
