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
import { isOngoing } from '@common/utils/date'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'

export function SessionRow({
  item: session,
  description,
  className,
  hideLink,
  highlight,
}: Readonly<BaseRowProps<SessionWithSignups> & { description?: string }>) {
  const { loggedInUser, isLoggedIn } = useAuth()
  const distance = useDistanceToNow({ date: session.date })

  const isCancelled = session.status === 'cancelled'

  const isSignedUp =
    isLoggedIn && session.signups.some(su => su.user.id === loggedInUser.id)

  const content = (
    <>
      <ItemContent
        className={twMerge(
          isCancelled && 'text-muted-foreground line-through'
        )}>
        <ItemTitle>
          {isOngoing(session) && !isCancelled && (
            <div className='bg-primary size-2 animate-pulse rounded-full' />
          )}
          {session.name}
        </ItemTitle>
        <ItemDescription className='text-start'>
          <span>{description ?? distance}</span>
        </ItemDescription>
      </ItemContent>

      <ItemActions>
        <Badge variant='outline'>
          {loc.no.session.statusOptions[session.status]}
        </Badge>
        {isLoggedIn && !isSignedUp && !isCancelled && (
          <Badge>{loc.no.common.new}</Badge>
        )}
        {!hideLink && <ChevronRight className='size-4' />}
      </ItemActions>
    </>
  )

  if (hideLink) {
    return (
      <Item
        key={session.id}
        className={twMerge(
          highlight &&
            'bg-primary-background hover:bg-primary/25 ring-primary/50 ring-1',
          className
        )}
        asChild>
        <div>{content}</div>
      </Item>
    )
  }

  return (
    <Item
      key={session.id}
      className={twMerge(
        highlight &&
          'bg-primary-background hover:bg-primary/25 ring-primary/50 ring-1',
        className
      )}
      asChild>
      <Link to={`/sessions/${session.id}`}>{content}</Link>
    </Item>
  )
}
