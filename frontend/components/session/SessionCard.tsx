import { Badge } from '@/components/ui/badge'
import type { SessionStatus } from '@backend/database/schema'
import loc from '@common/locale/locales'
import {
  formatDateWithYear,
  formatTimeOnly,
  isOngoing,
  isPast,
  isUpcoming,
} from '@common/utils/date'
import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  QuestionMarkCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { twMerge } from 'tailwind-merge'
import type { SesssionComponentProps } from './SessionRow'
import SessionSignupButton from './SessionSignupButton'

function StatusIcon({
  status,
  ...props
}: Readonly<
  { status: SessionStatus } & Parameters<typeof CheckCircleIcon>[0]
>) {
  switch (status) {
    case 'cancelled':
      return <XCircleIcon {...props} />
    case 'confirmed':
      return <CheckCircleIcon {...props} />
    case 'tentative':
      return <QuestionMarkCircleIcon {...props} />
  }
}

export default function SessionCard({
  item: session,
  className,
  hideLink,
  highlight,
  ...props
}: Readonly<SesssionComponentProps>) {
  const isCancelled = session.status === 'cancelled'

  return (
    <div
      className={twMerge(
        'relative',
        isCancelled && 'text-muted-foreground line-through',
        highlight && 'bg-foreground/3',
        className
      )}
      {...props}>
      {!hideLink && (
        <Link
          to={`/sessions/${session.id}`}
          aria-label={session.name}
          className='absolute inset-0 rounded-sm transition-colors hover:bg-primary-foreground/5 focus-visible:outline-2 focus-visible:outline-primary'
        />
      )}
      <div className='flex w-full items-center justify-between'>
        <h1 className='min-w-0 text-3xl tracking-wide wrap-break-word'>
          {session.name}
        </h1>
        {!hideLink && <ChevronRight className='size-4' />}
      </div>

      {session.description && (
        <p className='text-muted-foreground'>{session.description}</p>
      )}

      <div className='mt-4 flex items-end justify-between'>
        <div className='flex flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <StatusIcon
              status={session.status}
              className='size-4 text-muted-foreground'
            />
            <span>{loc.no.session.statusOptions[session.status]}</span>
          </div>

          <div className='flex items-center gap-2'>
            <ClockIcon className='size-4 text-muted-foreground' />
            <span className='capitalize'>{formatTimeOnly(session.date)}</span>
          </div>

          <div className='flex items-center gap-2 capitalize'>
            <CalendarIcon className='size-4 text-muted-foreground' />
            {formatDateWithYear(session.date)}
          </div>

          {session.location && (
            <div className='flex items-center gap-2'>
              <MapPinIcon className='size-4 text-muted-foreground' />
              <span>{session.location}</span>
            </div>
          )}
        </div>

        <div className='flex flex-col items-end gap-4'>
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

          <div className='relative'>
            <SessionSignupButton key={session.id} session={session} />
          </div>
        </div>
      </div>
    </div>
  )
}
