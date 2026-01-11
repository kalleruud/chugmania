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
import MatchRow from '../match/MatchRow'
import { PageHeader } from '../PageHeader'
import { Badge } from '../ui/badge'
import GroupCard from './GroupCard'

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

  const groupStages = tournament.stages.filter(s => s.stage.bracket === 'group')
  const bracketStages = tournament.stages.filter(
    s => s.stage.bracket !== 'group'
  )

  const groupMatches = groupStages.flatMap(s => s.matches)
  const totalGroupMatches = groupMatches.length
  const completedGroupMatches = groupMatches.filter(
    gm =>
      gm.match && matches?.find(m => m.id === gm.match)?.status === 'completed'
  ).length

  const eliminationMatches = bracketStages.flatMap(s => s.matches)
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
          {groupStages.map((stageWithMatches, index) => (
            <div
              key={`${stageWithMatches.stage.bracket}-${stageWithMatches.stage.index}-${index}`}
              className='flex flex-col gap-2'>
              <h4 className='font-f1-bold text-sm uppercase'>
                {getRoundName(
                  stageWithMatches.stage.index,
                  stageWithMatches.stage.bracket
                )}
              </h4>
              {stageWithMatches.matches.map((match, matchIndex) => {
                return (
                  <MatchRow
                    className='bg-background-secondary rounded-sm border p-2'
                    key={match.id}
                    index={
                      stageWithMatches.matches.length > 1
                        ? matchIndex
                        : undefined
                    }
                    item={match.matchDetails ?? undefined}
                    tournamentMatch={match}
                    tournament={tournament}
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
          {bracketStages.map((stageWithMatches, index) => (
            <div
              key={`${stageWithMatches.stage.bracket}-${stageWithMatches.stage.index}-${index}`}
              className='flex flex-col gap-2'>
              <h4 className='font-f1-bold text-sm uppercase'>
                {getRoundName(
                  stageWithMatches.stage.index,
                  stageWithMatches.stage.bracket
                )}
              </h4>
              {stageWithMatches.matches.map((match, matchIndex) => (
                <MatchRow
                  key={match.id}
                  className='bg-background-secondary rounded-sm border p-2'
                  item={match.matchDetails ?? undefined}
                  tournamentMatch={match}
                  tournament={tournament}
                  index={
                    stageWithMatches.matches.length > 1 ? matchIndex : undefined
                  }
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
