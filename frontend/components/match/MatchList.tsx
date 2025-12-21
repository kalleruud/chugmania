import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import type { Match } from '@common/models/match'
import { PlusIcon } from '@heroicons/react/24/solid'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import MatchCard from './MatchCard'

import MatchRow from './MatchRow'

export type MatchListProps = {
  matches: Match[]
  onCreate?: () => void
  onSelect?: (match: Match) => void
  layout?: 'list' | 'grid'
}

export default function MatchList({
  matches,
  onCreate,
  onSelect,
  layout = 'grid',
}: Readonly<MatchListProps>) {
  const { isLoggedIn } = useAuth()

  if (matches.length === 0) {
    return (
      <Empty className='border-input text-muted-foreground border text-sm'>
        {isLoggedIn && onCreate && (
          <Button
            variant='outline'
            size='sm'
            className='text-muted-foreground w-fit'
            onClick={onCreate}>
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
              onClick={() => onSelect?.(match)}
            />
          ))}
        </div>
      ) : (
        <div className='bg-background-secondary flex flex-col rounded-sm'>
          {matches.map(match => (
            <MatchRow
              key={match.id}
              item={match}
              onClick={() => onSelect?.(match)}
            />
          ))}
        </div>
      )}

      {isLoggedIn && onCreate && (
        <Button
          variant='ghost'
          size='sm'
          className='text-muted-foreground w-fit'
          onClick={onCreate}>
          <PlusIcon />
          {loc.no.match.new}
        </Button>
      )}
    </div>
  )
}
