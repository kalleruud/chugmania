import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useActiveEntries } from '@/hooks/useActiveEntries'
import loc from '@common/locale/locales'
import type { EntryKind, EntryRef } from '@common/models/activeEntry'
import type { EntryStatus } from '@common/models/entry'
import { isUnplayed } from '@common/utils/activeEntry'
import { Pin, PinOff } from 'lucide-react'
import { useState } from 'react'
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
  subject?: string
  showLabel?: boolean
  className?: string
}

function pinSelector(kind: EntryKind, id: string): string {
  return `[data-now-pin="${kind}:${id}"]`
}

export default function NowButton({
  kind,
  entry,
  subject,
  showLabel,
  className,
}: Readonly<NowButtonProps>) {
  const { socket } = useConnection()
  const { isLoggedIn, loggedInUser } = useAuth()
  const { queues, getNow } = useActiveEntries()
  const [pending, setPending] = useState(false)
  const session = entry.session
  const now = getNow(kind, entry.id)

  if (!isLoggedIn || loggedInUser.role === 'user' || !session) return null
  if (!queues.has(session) || !isUnplayed(entry)) return null

  const pinned = now?.source === 'override'
  const label = pinned ? loc.no.activeEntry.clearNow : loc.no.activeEntry.setNow
  const Icon = pinned ? PinOff : Pin
  const current = queues.get(session)?.now
  const previous: EntryRef | null =
    current?.source === 'override'
      ? { kind: current.kind, id: current.entry.id }
      : null

  const send = async (target: EntryRef | null) => {
    const response = await socket.emitWithAck('set_active_entry', {
      type: 'SetActiveEntryRequest',
      session,
      entry: target,
    })
    if (!response.success) throw new Error(response.message)
  }

  const change = (refocus: boolean) => {
    setPending(true)
    const id = toast.loading(loc.no.activeEntry.toast.loading)
    send(pinned ? null : { kind, id: entry.id })
      .then(() => {
        toast.success(
          pinned
            ? loc.no.activeEntry.toast.cleared
            : loc.no.activeEntry.toast.pinned,
          {
            id,
            action: {
              label: loc.no.activeEntry.undo,
              onClick: () => {
                send(previous).catch(() =>
                  toast.error(loc.no.activeEntry.toast.error)
                )
              },
            },
          }
        )
        if (refocus)
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLElement>(pinSelector(kind, entry.id))
              ?.focus()
          )
      })
      .catch(() => toast.error(loc.no.activeEntry.toast.error, { id }))
      .finally(() => setPending(false))
  }

  return (
    <Button
      type='button'
      variant={showLabel ? 'outline' : 'ghost'}
      size={showLabel ? 'sm' : 'icon'}
      aria-label={subject ? `${label}: ${subject}` : label}
      title={label}
      disabled={pending}
      data-now-pin={`${kind}:${entry.id}`}
      className={twMerge(
        'shrink-0 text-muted-foreground',
        showLabel ? 'h-11 sm:h-8' : 'size-11 sm:size-8',
        className
      )}
      onClick={event => {
        event.stopPropagation()
        change(event.detail === 0)
      }}>
      <Icon className='size-4' />
      {showLabel && label}
    </Button>
  )
}
