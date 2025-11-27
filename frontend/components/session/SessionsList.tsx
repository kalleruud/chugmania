import { Empty } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { DateTime } from 'luxon'
import { twMerge } from 'tailwind-merge'
import { SessionItem } from './SessionItem'

type SessionsListProps = {
  className?: string
  limit?: number
  filter?: 'upcoming' | 'past' | 'all'
}

export function SessionsList({
  className,
  limit,
  filter = 'all',
}: Readonly<SessionsListProps>) {
  const { sessions: sd } = useData()

  if (sd === undefined) {
    return (
      <div className={twMerge('flex flex-col', className)}>
        <div className='overflow-clip rounded-sm'>
          <Skeleton className='divide-border h-16 w-full divide-y rounded-none' />
          <Skeleton className='divide-border h-16 w-full divide-y rounded-none' />
          <Skeleton className='divide-border h-16 w-full divide-y rounded-none' />
        </div>
      </div>
    )
  }

  const now = DateTime.now()
  let sessions = Object.values(sd)

  if (filter === 'upcoming') {
    sessions = sessions.filter(
      s => DateTime.fromJSDate(new Date(s.date)) >= now
    )
    sessions.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  } else if (filter === 'past') {
    sessions = sessions.filter(s => DateTime.fromJSDate(new Date(s.date)) < now)
    sessions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  } else {
    sessions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  if (limit) {
    sessions = sessions.slice(0, limit)
  }

  if (sessions.length === 0) {
    return (
      <Empty className='border-input text-muted-foreground border text-sm'>
        {loc.no.noItems}
      </Empty>
    )
  }

  return (
    <div className={twMerge('bg-background-secondary rounded-sm', className)}>
      {sessions.map(session => (
        <SessionItem
          key={session.id}
          session={session}
          variant='row'
          className='py-3 first:pt-4 last:pb-4'
        />
      ))}
    </div>
  )
}
