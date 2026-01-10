import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { TournamentWithDetails } from '@common/models/tournament'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import ConfirmationButton from '../ConfirmationButton'
import { PageSubheader } from '../PageHeader'
import { Badge } from '../ui/badge'
import GroupCard from './GroupCard'
import TournamentMatchRow from './TournamentMatchRow'
import { Label } from '../ui/label'

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
        <div className='grid grid-cols-1 gap-2 pb-4 sm:grid-cols-2'>
          {tournament.groups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              advancementCount={tournament.advancementCount}
            />
          ))}
        </div>

        <PageSubheader
          title={loc.no.tournament.groupStage}
          description={`${completedGroupMatches} / ${totalGroupMatches} matcher`}
        />

        {tournament.rounds
          .filter(br => br.bracket === 'group')
          .map((bracketRound, index) => (
            <div
              key={`${bracketRound.bracket}-${bracketRound.round}-${index}`}
              className='flex flex-col gap-1'>
              {bracketRound.matches.map(match => {
                const group = tournament.groups.find(g => g.id === match.group)
                return (
                  <TournamentMatchRow
                    key={match.id}
                    item={match}
                    groupName={loc.no.tournament.groupName(group?.number ?? 0)}
                  />
                )
              })}
            </div>
          ))}

        {tournament.rounds
          .filter(br => br.bracket !== 'group')
          .map((bracketRound, index) => (
            <div
              key={`${bracketRound.bracket}-${bracketRound.round}-${index}`}
              className='flex flex-col gap-1'>
              <h4 className='font-f1-bold text-sm uppercase'>
                {loc.no.tournament.bracketRoundName(
                  bracketRound.bracket,
                  bracketRound.round
                )}
              </h4>
              {bracketRound.matches.map(match => (
                <TournamentMatchRow key={match.id} item={match} />
              ))}
            </div>
          ))}
      </div>
    </div>
  )
}
