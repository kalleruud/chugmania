import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useTimeAgoStrict as useDistanceToNow } from '@/hooks/useTimeAgoStrict'
import loc from '@/lib/locales'
import type { SessionWithSignups } from '@common/models/session'
import {
  formatDateWithYear,
  formatTimeOnly,
  isOngoing,
  isPast,
  isUpcoming,
} from '@common/utils/date'
import { CalendarIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/solid'
import { ChevronRight, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'

type SessionItemProps = {
  session: SessionWithSignups
  variant: 'row' | 'card'
  className?: string
}

export function SessionItem(props: Readonly<SessionItemProps>) {
  switch (props.variant) {
    case 'row':
      return <SessionRow {...props} />
    case 'card':
      return <SessionCard {...props} />
  }
}

function SessionRow({ session, className }: Readonly<SessionItemProps>) {
  const { loggedInUser, isLoggedIn } = useAuth()
  const timeAgo = useDistanceToNow({ date: session.date })

  const isSignedUp =
    isLoggedIn && session.signups.some(su => su.user.id === loggedInUser.id)

  const displayTime = isOngoing(session) ? 'Nå' : timeAgo

  return (
    <Item key={session.id} className={className} asChild>
      <Link to={`/sessions/${session.id}`}>
        <ItemContent>
          <ItemTitle>
            {isOngoing(session) && (
              <div className='bg-primary size-2 animate-pulse rounded-full' />
            )}
            {session.name}
          </ItemTitle>
          <ItemDescription>
            <span>{displayTime}</span>
          </ItemDescription>
        </ItemContent>

        <ItemActions>
          {isLoggedIn && !isSignedUp && <Badge>{loc.no.common.new}</Badge>}
          <ChevronRight className='size-4' />
        </ItemActions>
      </Link>
    </Item>
  )
}

function SessionCard({ session, className }: Readonly<SessionItemProps>) {
  const { socket } = useConnection()
  const { loggedInUser, isLoggedIn, isLoading } = useAuth()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canEdit = isAdmin || isModerator

  const handleDeleteSession = async () => {
    toast.promise(
      socket
        .emitWithAck('delete_session', {
          type: 'DeleteSessionRequest',
          id: session.id,
        })
        .then(r => {
          setDeleteDialogOpen(false)
          if (!r.success) throw new Error(r.message)
          return r
        }),
      {
        loading: 'Sletter session...',
        success: 'Sesjonen ble slettet',
        error: (err: Error) => `Sletting feilet: ${err.message}`,
      }
    )
  }

  return (
    <div className={twMerge('flex flex-col gap-2', className)}>
      <h1 className='text-3xl tracking-wide'>{session.name}</h1>
      {session.description && (
        <p className='text-muted-foreground'>{session.description}</p>
      )}

      <div className='flex items-start justify-between'>
        <div className='flex flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <ClockIcon className='text-muted-foreground size-4' />
            <span className='capitalize'>{formatTimeOnly(session.date)}</span>
          </div>

          <div className='flex items-center gap-2'>
            <CalendarIcon className='text-muted-foreground size-4' />
            {formatDateWithYear(session.date)}
          </div>

          {session.location && (
            <div className='flex items-center gap-2'>
              <MapPinIcon className='text-muted-foreground size-4' />
              <span>{session.location}</span>
            </div>
          )}
        </div>

        <div className='flex flex-col items-end gap-2'>
          <div>
            {isPast(session) && (
              <Badge variant='outline'>{loc.no.session.status.past}</Badge>
            )}
            {isOngoing(session) && (
              <Badge className='animate-pulse'>
                {loc.no.session.status.ongoing}
              </Badge>
            )}
            {isUpcoming(session) && (
              <Badge variant='outline'>{loc.no.session.status.upcoming}</Badge>
            )}
          </div>

          {canEdit && (
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant='destructive' size='sm'>
                  <Trash2 className='mr-2 size-4' />
                  {loc.no.common.delete}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{loc.no.dialog.confirmDelete.title}</DialogTitle>
                  <DialogDescription>
                    {loc.no.dialog.confirmDelete.description}
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant='outline'>{loc.no.dialog.cancel}</Button>
                  </DialogClose>
                  <Button
                    variant='destructive'
                    onClick={handleDeleteSession}
                    disabled={isLoading}>
                    {loc.no.common.delete}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  )
}
