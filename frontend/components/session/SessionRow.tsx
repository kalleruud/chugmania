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
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'

export function SessionRow({
  item: session,
  className,
  hideLink,
  highlight,
}: Readonly<BaseRowProps<SessionWithSignups>>) {
  const { loggedInUser, isLoggedIn } = useAuth()
  const timeAgo = useDistanceToNow({ date: session.date })

  const isCancelled = session.status === 'cancelled'

  const isSignedUp =
    isLoggedIn && session.signups.some(su => su.user.id === loggedInUser.id)

  const content = (
    <>
      <ItemContent
        className={twMerge(
          isCancelled && 'text-muted-foreground line-through'
        )}>
        <ItemTitle className='font-bold'>{session.name}</ItemTitle>
        <ItemDescription>
          <span>{timeAgo}</span>
        </ItemDescription>
      </ItemContent>

      {!hideLink && (
        <ItemActions>
          <Badge variant='outline'>
            {loc.no.session.statusOptions[session.status]}
          </Badge>
          {isLoggedIn && !isSignedUp && <Badge>{loc.no.common.new}</Badge>}
          <ChevronRight className='size-4' />
        </ItemActions>
      )}
      {hideLink && (
        <div className='flex gap-2'>
          <Badge variant='outline'>
            {loc.no.session.statusOptions[session.status]}
          </Badge>
          {isLoggedIn && !isSignedUp && <Badge>{loc.no.common.new}</Badge>}
        </div>
      )}
    </>
  )

  if (hideLink) {
    return (
      <Item key={session.id} className={className} asChild>
        <div>{content}</div>
      </Item>
    )
  }

  return (
    <Item key={session.id} className={className} asChild>
      <Link to={`/sessions/${session.id}`}>{content}</Link>
    </Item>
  )
}
