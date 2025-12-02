import { Empty } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { type ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { SessionItem } from './SessionItem'

type SessionsListProps = {
  className?: string
  header: string
  collapsed?: boolean
  limit?: number
  before?: Date
  after?: Date
}

export default function SessionsList({
  className,
  header,
  limit,
  before,
  after,
  ...rest
}: Readonly<SessionsListProps & ComponentProps<'div'>>) {
  const { sessions: sd } = useData()

  if (sd === undefined) {
    return (
      <div className={twMerge('flex flex-col gap-2', className)} {...rest}>
        <h2 className='text-muted-foreground text-sm font-medium uppercase'>
          {header}
        </h2>
        <Skeleton className='divide-border h-16 w-full divide-y rounded-sm' />
      </div>
    )
  }

  const sessions = Object.values(sd)
    .filter(s => {
      if (after && new Date(s.date) <= after) return false
      if (before && new Date(s.date) > before) return false
      return true
    })
    .slice(0, limit)

  if (sessions.length === 0) {
    return (
      <Empty className='border-input text-muted-foreground border text-sm'>
        {loc.no.common.noItems}
      </Empty>
    )
  }

  return (
    <div className={twMerge('flex flex-col gap-2', className)} {...rest}>
      <h2 className='text-muted-foreground text-sm font-medium uppercase'>
        {header}
      </h2>

      <div className={twMerge('bg-background-secondary rounded-sm')}>
        {sessions.map(session => (
          <SessionItem
            key={session.id}
            session={session}
            variant='row'
            className='py-3 first:pt-4 last:pb-4'
          />
        ))}
      </div>
    </div>
  )
}
