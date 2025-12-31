import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { TournamentWithDetails } from '@common/models/tournament'
import { ChevronDownIcon, ChevronUpIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import ConfirmationButton from '../ConfirmationButton'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import GroupCard from './GroupCard'
import TournamentBracket from './TournamentBracket'

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
    m => m.matchDetails?.status === 'completed'
  ).length
  const totalGroupMatches = groupMatches.length

  const completedBracketMatches = bracketMatches.filter(
    m => m.matchDetails?.status === 'completed'
  ).length
  const totalBracketMatches = bracketMatches.filter(
    m => m.matchDetails !== null
  ).length

  return (
    <div
      className={twMerge(
        'bg-background-secondary flex flex-col gap-4 rounded-lg border p-4',
        className
      )}>
      <div className='flex items-center justify-between'>
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
              variant='ghost'
              size='icon'
              onClick={handleDelete}>
              <Trash2 className='size-4' />
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
        <>
          <div className='flex flex-col gap-4'>
            <div className='flex items-center justify-between'>
              <h4 className='font-f1-bold text-sm uppercase'>
                {loc.no.tournament.groupStage}
              </h4>
              <span className='text-muted-foreground text-xs'>
                {completedGroupMatches}/{totalGroupMatches} matcher
              </span>
            </div>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              {tournament.groups.map(group => (
                <GroupCard
                  key={group.id}
                  group={group}
                  matches={groupMatches
                    .filter(m => {
                      const playerIds = group.players.map(p => p.user.id)
                      return (
                        playerIds.includes(m.matchDetails?.user1 ?? '') ||
                        playerIds.includes(m.matchDetails?.user2 ?? '')
                      )
                    })
                    .map(m => m.matchDetails)
                    .filter((m): m is NonNullable<typeof m> => m !== null)}
                />
              ))}
            </div>
          </div>

          {bracketMatches.length > 0 && (
            <div className='flex flex-col gap-4'>
              <div className='flex items-center justify-between'>
                <h4 className='font-f1-bold text-sm uppercase'>
                  {loc.no.tournament.bracket}
                </h4>
                <span className='text-muted-foreground text-xs'>
                  {completedBracketMatches}/{totalBracketMatches} matcher
                </span>
              </div>
              <TournamentBracket
                matches={bracketMatches}
                groups={tournament.groups}
                allMatches={matches}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
