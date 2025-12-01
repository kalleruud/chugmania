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

  return (
    <div className={twMerge('flex flex-col gap-1', className)}>
      <h1 className='text-2xl font-bold'>{session.name}</h1>
      <p className='text-muted-foreground text-lg'>
        {date.setLocale('nb').toFormat('cccc d. MMMM HH:mm')}
      </p>
      {session.location && (
        <p className='text-muted-foreground'>{session.location}</p>
      )}
    </div>
  )
}
