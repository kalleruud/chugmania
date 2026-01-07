import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { TournamentBracket } from '@backend/database/schema'
import type { TournamentWithDetails } from '@common/models/tournament'
import { ChevronDownIcon, ChevronUpIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import ConfirmationButton from '../ConfirmationButton'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import GroupCard from './GroupCard'
import TournamentMatchRow from './TournamentMatchRow'

type TournamentCardProps = {
  tournament: TournamentWithDetails
  className?: string
}

export default function TournamentCard({
  tournament,
  className,
}: Readonly<TournamentCardProps>) {
  const { socket } = useConnection()
  const { isLoggedIn, loggedInUser } = useAuth()
  const { matches } = useData()
  const [expanded, setExpanded] = useState(true)

  const canEdit = isLoggedIn && loggedInUser.role !== 'user'

  const handleDelete = () => {
    toast.promise(
      socket
        .emitWithAck('delete_tournament', {
          type: 'DeleteTournamentRequest',
          id: tournament.id,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
        }),
      loc.no.tournament.toast.delete
    )
  }

  const groupMatches = tournament.matches.filter(m => m.bracket === 'group')
  const bracketMatches = tournament.matches.filter(m => m.bracket !== 'group')

  const completedGroupMatches = groupMatches.filter(
    gm =>
      gm.match && matches?.find(m => m.id === gm.match)?.status === 'completed'
  ).length
  const totalGroupMatches = groupMatches.length

  const completedBracketMatches = bracketMatches.filter(
    bm =>
      bm.match && matches?.find(m => m.id === bm.match)?.status === 'completed'
  ).length
  const totalBracketMatches = bracketMatches.filter(
    bm => bm.match !== null
  ).length

  return (
    <div
      className={twMerge(
        'bg-background-secondary flex flex-col gap-4 rounded-lg border p-2',
        className
      )}>
      <div className='flex items-center justify-between p-2'>
        <div className='flex flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <h3 className='font-f1-bold text-lg uppercase'>
              {tournament.name}
            </h3>
            <Badge variant='outline'>
              {loc.no.tournament.eliminationType[tournament.eliminationType]}
            </Badge>
          </div>
          {tournament.description && (
            <p className='text-muted-foreground text-sm'>
              {tournament.description}
            </p>
          )}
        </div>
        <div className='flex items-center gap-2'>
          {canEdit && (
            <ConfirmationButton
              onClick={handleDelete}
              variant='destructive'
              size='sm'>
              <Trash2 className='size-4' />
              {loc.no.common.delete}
            </ConfirmationButton>
          )}
          <Button
            variant='ghost'
            size='icon'
            onClick={() => setExpanded(!expanded)}>
            {expanded ? (
              <ChevronUpIcon className='size-4' />
            ) : (
              <ChevronDownIcon className='size-4' />
            )}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className='flex flex-col gap-4'>
          <div className='flex items-center justify-between px-2'>
            <h4 className='font-f1-bold text-sm uppercase'>
              {loc.no.tournament.groupStage}
            </h4>
            <span className='text-muted-foreground text-xs'>
              {completedGroupMatches}/{totalGroupMatches} matcher
            </span>
          </div>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            {tournament.groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                advancementCount={tournament.advancementCount}
              />
            ))}
          </div>

          {tournament.matchesByRound
            .filter(br => br.bracket !== 'group')
            .map((bracketRound, index) => (
              <div key={`${bracketRound.bracket}-${bracketRound.round}-${index}`} className='flex flex-col gap-1'>
                <h4 className='font-f1-bold text-sm uppercase'>
                  {loc.no.tournament.bracketType[bracketRound.bracket as TournamentBracket]}{' '}
                  - {bracketRound.round}
                </h4>
                {bracketRound.matches.map(match => (
                  <TournamentMatchRow key={match.id} item={match} />
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
