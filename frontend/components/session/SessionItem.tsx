import { isOngoing, isPast, isUpcoming } from '@/app/utils/date'
import { Badge } from '@/components/ui/badge'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  SlashIcon,
} from '@heroicons/react/24/solid'
import { ChevronRight } from 'lucide-react'
import { DateTime } from 'luxon'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import type { SessionWithSignups } from '../../../common/models/session'

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
  const date = DateTime.fromJSDate(new Date(session.date))

  const isSignedUp =
    isLoggedIn && session.signups.some(su => su.user.id === loggedInUser.id)

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
          <ItemDescription className='flex items-center gap-1 capitalize'>
            {session.location && (
              <>
                <span>{session.location}</span>
                <SlashIcon className='size-4 opacity-50' />
              </>
            )}
            <span>{date.setLocale('nb').toFormat('cccc d. MMMM HH:mm')}</span>
          </ItemDescription>
        </ItemContent>

        <ItemActions>
          {!isSignedUp && <Badge>{loc.no.common.new}</Badge>}
          <ChevronRight className='size-4' />
        </ItemActions>
      </Link>
    </Item>
  )
}

function SessionCard({ session, className }: Readonly<SessionItemProps>) {
  const date = DateTime.fromJSDate(new Date(session.date))

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
            <span className='capitalize'>{date.toFormat('HH:mm')}</span>
          </div>

          <div className='flex items-center gap-2'>
            <CalendarIcon className='text-muted-foreground size-4' />
            <span className='capitalize'>
              {date.toFormat('cccc d. MMMM yyyy')}
            </span>
          </div>

          {session.location && (
            <div className='flex items-center gap-2'>
              <MapPinIcon className='text-muted-foreground size-4' />
              <span>{session.location}</span>
            </div>
          )}
        </div>

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
    </div>
  )
}
