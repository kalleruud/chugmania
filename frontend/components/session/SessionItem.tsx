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
import { CalendarIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/solid'
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
  const isPast = date < DateTime.now()

  const isSignedUp =
    isLoggedIn && session.signups.some(su => su.user.id === loggedInUser.id)

  return (
    <Item key={session.id} className={className} asChild>
      <Link to={`/sessions/${session.id}`}>
        <ItemContent>
          <ItemTitle className={twMerge(isPast && 'text-muted-foreground')}>
            {session.name}
          </ItemTitle>
          <ItemDescription className='flex items-center gap-2 capitalize'>
            {session.location && (
              <>
                <span>{session.location}</span>
                <span className='opacity-50'>{session.location && '•'}</span>
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

  const now = DateTime.now()

  const isThisDate = date.hasSame(now, 'day')
  const isAfterStartTime =
    now >= date.set({ hour: 0, minute: 0, second: 0 }) &&
    now <= date.set({ hour: 23, minute: 59, second: 59 })
  const isNow = isThisDate && isAfterStartTime

  const isPast = !isNow && date < now
  const isFuture = !isNow && date > now

  return (
    <div className={twMerge('flex flex-col gap-1', className)}>
      <h1 className='text-3xl tracking-wide'>{session.name}</h1>
      {session.description && (
        <p className='text-muted-foreground'>{session.description}</p>
      )}

      {isPast && <Badge variant='outline'>{loc.no.session.status.past}</Badge>}
      {isNow && (
        <Badge variant='outline' className='animate-pulse'>
          {loc.no.session.status.ongoing}
        </Badge>
      )}
      {isFuture && <Badge>{loc.no.session.status.upcoming}</Badge>}

      <div className='flex items-center gap-2'>
        <ClockIcon className='text-primary size-5' />
        <span className='capitalize'>{date.toFormat('HH:mm')}</span>
      </div>

      <div className='flex items-center gap-2'>
        <CalendarIcon className='text-primary size-5' />
        <span className='capitalize'>{date.toFormat('cccc d. MMMM yyyy')}</span>
      </div>

      {session.location && (
        <div className='flex items-center gap-2'>
          <MapPinIcon className='text-primary size-5' />
          <span>{session.location}</span>
        </div>
      )}
    </div>
  )
}
