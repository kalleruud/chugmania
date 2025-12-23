import { useAuth } from '@/contexts/AuthContext'
import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import loc from '@/lib/locales'
import type { Match } from '@common/models/match'
import { PlusIcon } from '@heroicons/react/24/solid'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import MatchCard from './MatchCard'
import MatchRow from './MatchRow'

export type MatchListProps = {
  track?: string
  user?: string
  session?: string
  matches: Match[]
  layout?: 'list' | 'grid'
  hideTrack?: boolean
}

export default function MatchList({
  matches,
  track,
  user,
  session,
  layout = 'grid',
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
    <div className='flex flex-col gap-3'>
      {layout === 'grid' ? (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {matches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              onClick={() => openMatch(match)}
            />
          ))}
        </div>
      ) : (
        <div className='bg-background-secondary flex flex-col rounded-sm'>
          {matches.map(match => (
            <MatchRow
              key={match.id}
              item={match}
              highlight={
                match.status !== 'cancelled' &&
                isLoggedIn &&
                (match.user1 === loggedInUser.id ||
                  match.user2 === loggedInUser.id)
              }
              className='py-2 first:pt-4 last:pb-4'
              onClick={() => openMatch(match)}
              hideTrack={hideTrack}
            />
          ))}
        </div>
      )}

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
