import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useTimeEntryInput } from '@/contexts/TimeEntryInputContext'
import loc from '@common/locale/locales'
import type { Match } from '@common/models/match'
import { PlusIcon } from '@heroicons/react/24/solid'
import { Fragment } from 'react'
import { TrackRow } from '../track/TrackRow'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import MatchCard from './MatchCard'
import MatchRow from './MatchRow'

export type MatchListProps = {
  track?: string
  user?: string
  session?: string
  matches: Match[]
  managed?: boolean
  hideTrack?: boolean
  trackSeparators?: boolean
  featuredMatchId?: string
}

export default function MatchList({
  matches,
  track,
  user,
  session,
  hideTrack,
  trackSeparators,
  managed,
  featuredMatchId,
}: Readonly<MatchListProps>) {
  const { isLoggedIn, loggedInUser } = useAuth()
  const { tracks } = useData()
  const { openMatch } = useTimeEntryInput()

  if (matches.length === 0) {
    return (
      <Empty className='border border-input text-sm text-muted-foreground'>
        {isLoggedIn && !managed && (
          <Button
            variant='outline'
            size='sm'
            className='w-fit text-muted-foreground'
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
      {matches.map((match, index) => {
        const MatchComponent =
          match.id === featuredMatchId ? MatchCard : MatchRow
        const separatorTrack =
          trackSeparators &&
          (index === 0 || match.track !== matches.at(index - 1)?.track)
            ? tracks?.find(track => track.id === match.track)
            : undefined
        return (
          <Fragment key={match.id}>
            {separatorTrack && (
              <TrackRow item={separatorTrack} className='border-b px-2 py-3' />
            )}
            <MatchComponent
              item={match}
              highlight={
                match.status !== 'cancelled' &&
                isLoggedIn &&
                (match.user1 === loggedInUser.id ||
                  match.user2 === loggedInUser.id)
              }
              className='rounded-sm bg-background-secondary p-2'
              onClick={() => {
                if (!match.tournament?.readOnly) openMatch(match)
              }}
              hideTrack={hideTrack || trackSeparators}
            />
          </Fragment>
        )
      })}

      {isLoggedIn && !managed && (
        <Button
          variant='ghost'
          size='sm'
          className='w-fit text-muted-foreground'
          onClick={() => openMatch({ track, user1: user, session })}>
          <PlusIcon />
          {loc.no.match.new}
        </Button>
      )}
    </div>
  )
}
