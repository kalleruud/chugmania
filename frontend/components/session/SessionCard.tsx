import { Badge } from '@/components/ui/badge'
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
import { type ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

type SessionCardProps = {
  session: SessionWithSignups
  className?: string
} & ComponentProps<'div'>

export default function SessionCard({
  session,
  className,
  ...props
}: Readonly<SessionCardProps>) {
  const isCancelled = session.status === 'cancelled'

  return (
    <div
      className={twMerge(
        'flex flex-col gap-2',
        isCancelled && 'text-muted-foreground line-through',
        className
      )}
      {...props}>
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
