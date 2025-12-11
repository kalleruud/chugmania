import { Badge } from '@/components/ui/badge'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import { useAuth } from '@/contexts/AuthContext'
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
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
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

  const isCancelled = session.status === 'cancelled'

  const isSignedUp =
    isLoggedIn && session.signups.some(su => su.user.id === loggedInUser.id)

  return (
    <Item key={session.id} className={className} asChild>
      <Link to={`/sessions/${session.id}`}>
        <ItemContent
          className={twMerge(
            isCancelled && 'text-muted-foreground line-through'
          )}>
          <ItemTitle className='font-bold'>{session.name}</ItemTitle>
          <ItemDescription>
            <span>{timeAgo}</span>
          </ItemDescription>
        </ItemContent>

        <ItemActions>
          <Badge variant='outline'>
            {loc.no.session.statusOptions[session.status]}
          </Badge>
          {isLoggedIn && !isSignedUp && <Badge>{loc.no.common.new}</Badge>}
          <ChevronRight className='size-4' />
        </ItemActions>
      </Link>
    </Item>
  )
}

function SessionCard({ session, className }: Readonly<SessionItemProps>) {
  const isCancelled = session.status === 'cancelled'

  return (
    <div
      className={twMerge(
        'flex flex-col gap-2',
        isCancelled && 'text-muted-foreground line-through',
        className
      )}>
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

          <div className='flex items-center gap-2 capitalize'>
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

          <Badge variant='outline'>
            {loc.no.session.statusOptions[session.status]}
          </Badge>
        </div>
      </div>
    </div>
  )
}
