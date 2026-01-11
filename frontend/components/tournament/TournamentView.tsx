import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { getRoundName } from '@/lib/utils'
import type { TournamentWithDetails } from '@common/models/tournament'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import ConfirmationButton from '../ConfirmationButton'
import { PageHeader } from '../PageHeader'
import { Badge } from '../ui/badge'
import GroupCard from './GroupCard'
import TournamentMatchRow from './TournamentMatchRow'

type TournamentViewProps = {
  tournament: TournamentWithDetails
  isReadOnly?: boolean
  className?: string
}

export default function TournamentView({
  tournament,
  isReadOnly = false,
  className,
}: Readonly<TournamentViewProps>) {
  const { socket } = useConnection()
  const { isLoggedIn, loggedInUser } = useAuth()
  const { matches } = useData()

  const canEdit = !isReadOnly && isLoggedIn && loggedInUser.role !== 'user'

  const groupMatches = tournament.rounds
    .filter(m => m.bracket === 'group')
    .flatMap(r => r.matches)

  const totalGroupMatches = groupMatches.length
  const completedGroupMatches = groupMatches.filter(
    gm =>
      gm.match && matches?.find(m => m.id === gm.match)?.status === 'completed'
  ).length

  const eliminationMatches = tournament.rounds
    .filter(m => m.bracket !== 'group')
    .flatMap(r => r.matches)

  const totalEliminationMatches = eliminationMatches.length
  const completedEliminationMatches = eliminationMatches.filter(
    gm =>
      gm.match && matches?.find(m => m.id === gm.match)?.status === 'completed'
  ).length

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

  return (
    <div className={twMerge('flex flex-col gap-4', className)}>
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
        </div>
      </div>

      <div className='flex flex-col gap-4'>
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
          {tournament.groups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              advancementCount={tournament.advancementCount}
            />
          ))}
        </div>

        <PageHeader
          className='py-0'
          title={loc.no.tournament.groupStage}
          description={`${completedGroupMatches} / ${totalGroupMatches} matcher`}
        />

        <div className='flex flex-col gap-8'>
          {tournament.rounds
            .filter(br => br.bracket === 'group')
            .map((groupRound, index) => (
              <div
                key={`${groupRound.bracket}-${groupRound.round}-${index}`}
                className='flex flex-col gap-2'>
                <h4 className='font-f1-bold text-sm uppercase'>
                  {getRoundName(groupRound.round ?? 0, groupRound.bracket)}
                </h4>
                {groupRound.matches.map(match => {
                  return (
                    <TournamentMatchRow
                      className='bg-background-secondary rounded-sm border p-2'
                      key={match.id}
                      index={groupRound.matches.length > 1 ? index : undefined}
                      item={match}
                      isReadOnly={isReadOnly}
                    />
                  )
                })}
              </div>
            ))}
        </div>

        <PageHeader
          className='py-0'
          title={loc.no.tournament.bracket}
          description={`${completedEliminationMatches} / ${totalEliminationMatches} matcher`}
        />

        <div className='flex flex-col gap-8'>
          {tournament.rounds
            .filter(br => br.bracket !== 'group')
            .map((bracketRound, index) => (
              <div
                key={`${bracketRound.bracket}-${bracketRound.round}-${index}`}
                className='flex flex-col gap-2'>
                <h4 className='font-f1-bold text-sm uppercase'>
                  {getRoundName(bracketRound.round ?? 0, bracketRound.bracket)}
                </h4>
                {bracketRound.matches.map((match, index) => (
                  <TournamentMatchRow
                    key={match.id}
                    index={bracketRound.matches.length > 1 ? index : undefined}
                    item={match}
                    isReadOnly={isReadOnly}
                  />
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
