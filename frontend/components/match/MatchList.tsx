import { useAuth } from '@/contexts/AuthContext'
import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import loc from '@/lib/locales'
import type { Match } from '@common/models/match'
import { PlusIcon } from '@heroicons/react/24/solid'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import MatchRow from './MatchRow'

export type MatchListProps = {
  track?: string
  user?: string
  session?: string
  matches: Match[]
  hideTrack?: boolean
}

export default function MatchList({
  matches,
  track,
  user,
  session,
  hideTrack,
}: Readonly<MatchListProps>) {
  const { isLoggedIn, loggedInUser } = useAuth()
  const { openMatch } = useTimeEntryInput()

  if (matches.length === 0) {
    return (
      <Empty className='border-input text-muted-foreground border text-sm'>
        {isLoggedIn && (
          <Button
            variant='outline'
            size='sm'
            className='text-muted-foreground w-fit'
            onClick={() => openMatch({ track, user1: user, session })}>
            <PlusIcon />
            {loc.no.match.new}
          </Button>
        )}
        {!isLoggedIn && loc.no.match.noMatches}
      </Empty>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      {matches.map(match => (
        <MatchRow
          key={match.id}
          item={match}
          highlight={
            match.status !== 'cancelled' &&
            isLoggedIn &&
            (match.user1 === loggedInUser.id || match.user2 === loggedInUser.id)
          }
          className='bg-background-secondary rounded-sm p-2'
          onClick={() => openMatch(match)}
          hideTrack={hideTrack}
        />
      ))}

      {isLoggedIn && (
        <Button
          variant='ghost'
          size='sm'
          className='text-muted-foreground w-fit'
          onClick={() => openMatch({ track, user1: user, session })}>
          <PlusIcon />
          {loc.no.match.new}
        </Button>
      )}
    </div>
  )
}
