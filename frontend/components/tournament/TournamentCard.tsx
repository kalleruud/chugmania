import MatchRow from '@/components/match/MatchRow'
import { PageSubheader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import type {
  TournamentMatch,
  TournamentWithStructure,
} from '@common/models/tournament'
import { PencilIcon, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'

function labelForGroupRank(groupName: string, rank: number) {
  if (rank === 1) return `Winner of ${groupName}`
  if (rank === 2) return `Runner-up of ${groupName}`
  return `#${rank} of ${groupName}`
}

function labelForMatchProgression(
  matchName: string,
  progression: 'winner' | 'loser'
) {
  return `${progression === 'winner' ? 'Winner' : 'Loser'} of ${matchName}`
}

function getPlaceholderText(
  tournament: TournamentWithStructure,
  slot: TournamentMatch,
  side: 'A' | 'B'
) {
  const groupById = new Map(tournament.groups.map(g => [g.id, g]))
  const slotById = new Map(tournament.tournamentMatches.map(m => [m.id, m]))

  if (side === 'A') {
    if (slot.sourceGroupA && slot.sourceGroupARank) {
      const group = groupById.get(slot.sourceGroupA)
      return labelForGroupRank(group?.name ?? 'Group', slot.sourceGroupARank)
    }
    if (slot.sourceMatchA && slot.sourceMatchAProgression) {
      const source = slotById.get(slot.sourceMatchA)
      return labelForMatchProgression(
        source?.name ?? 'Match',
        slot.sourceMatchAProgression
      )
    }
    return 'TBD'
  }

  if (slot.sourceGroupB && slot.sourceGroupBRank) {
    const group = groupById.get(slot.sourceGroupB)
    return labelForGroupRank(group?.name ?? 'Group', slot.sourceGroupBRank)
  }
  if (slot.sourceMatchB && slot.sourceMatchBProgression) {
    const source = slotById.get(slot.sourceMatchB)
    return labelForMatchProgression(
      source?.name ?? 'Match',
      slot.sourceMatchBProgression
    )
  }
  return 'TBD'
}

function TournamentMatchRow({
  tournament,
  slot,
}: Readonly<{ tournament: TournamentWithStructure; slot: TournamentMatch }>) {
  const data = useData()
  if (data.isLoadingData) {
    return (
      <div className='bg-background-secondary text-muted-foreground flex items-center justify-between rounded-sm p-2'>
        <div className='flex flex-col'>
          <span className='text-xs'>{slot.name}</span>
          <span className='text-sm'>Loading…</span>
        </div>
      </div>
    )
  }

  const match = (data.matches ?? []).find(m => m.id === slot.match)

  if (match) {
    return (
      <MatchRow item={match} hideTrack className='bg-background-secondary' />
    )
  }

  return (
    <div className='bg-background-secondary text-muted-foreground flex items-center justify-between rounded-sm p-2'>
      <div className='flex flex-col'>
        <span className='text-xs'>{slot.name}</span>
        <span className='text-sm'>
          {getPlaceholderText(tournament, slot, 'A')} vs{' '}
          {getPlaceholderText(tournament, slot, 'B')}
        </span>
      </div>
      <span className='text-xs opacity-70'>Pending</span>
    </div>
  )
}

export default function TournamentCard({
  tournament,
  className,
}: Readonly<{ tournament: TournamentWithStructure; className?: string }>) {
  const { socket } = useConnection()
  const { loggedInUser, isLoggedIn } = useAuth()

  const canEdit = isLoggedIn && loggedInUser.role !== 'user'

  const { groupMatches, upperMatches, lowerMatches } = useMemo(() => {
    const tMatches = tournament.tournamentMatches
    const groupMatches = tMatches.filter(m => m.bracket === 'group')
    const upperMatches = tMatches
      .filter(m => m.bracket === 'upper' && m.round !== 0)
      .toSorted((a, b) => b.round - a.round)
    const lowerMatches = tMatches
      .filter(m => m.bracket === 'lower' && m.round !== 0)
      .toSorted((a, b) => b.round - a.round)

    return { groupMatches, upperMatches, lowerMatches }
  }, [tournament.tournamentMatches])

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
      {
        loading: 'Sletter turnering...',
        success: 'Turneringen ble slettet',
        error: (e: Error) => `Sletting feilet: ${e.message}`,
      }
    )
  }

  return (
    <Card className={twMerge('gap-4', className)}>
      <CardHeader>
        <CardTitle>{tournament.name}</CardTitle>
        {tournament.description && (
          <CardDescription>{tournament.description}</CardDescription>
        )}
        <CardDescription>
          {tournament.eliminationType.toUpperCase()} • {tournament.groupsCount}{' '}
          groups • {tournament.advancementCount} advancers/group
        </CardDescription>

        {canEdit && (
          <CardAction className='flex gap-2'>
            <Button variant='outline' size='sm' disabled>
              <PencilIcon className='size-4' />
              Edit
            </Button>
            <Button variant='destructive' size='sm' onClick={handleDelete}>
              <Trash2 className='size-4' />
              Delete
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className='grid gap-4'>
        <div className='grid gap-2'>
          <PageSubheader
            title='Groups'
            description={`${tournament.groups.length}`}
          />
          <div className='grid gap-2 md:grid-cols-2'>
            {tournament.groups.map(g => (
              <div
                key={g.id}
                className='bg-background-secondary rounded-sm border p-3'>
                <div className='flex items-center justify-between'>
                  <span className='font-semibold'>{g.name}</span>
                  <span className='text-muted-foreground text-xs'>
                    {g.players.length} players
                  </span>
                </div>
                <div className='mt-2 grid gap-1'>
                  {g.players.map(p => (
                    <div
                      key={p.id}
                      className='flex items-center justify-between'>
                      <span className='text-sm'>
                        {p.seed}. {p.user.shortName ?? p.user.firstName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className='grid gap-2'>
          <PageSubheader
            title='Group matches'
            description={`${groupMatches.length}`}
          />
          <div className='grid gap-2'>
            {groupMatches.map(m => (
              <TournamentMatchRow key={m.id} tournament={tournament} slot={m} />
            ))}
          </div>
        </div>

        <div className='grid gap-2'>
          <PageSubheader
            title='Upper bracket'
            description={`${upperMatches.length}`}
          />
          <div className='grid gap-2'>
            {upperMatches.map(m => (
              <TournamentMatchRow key={m.id} tournament={tournament} slot={m} />
            ))}
          </div>
        </div>

        {lowerMatches.length > 0 && (
          <div className='grid gap-2'>
            <PageSubheader
              title='Lower bracket'
              description={`${lowerMatches.length}`}
            />
            <div className='grid gap-2'>
              {lowerMatches.map(m => (
                <TournamentMatchRow
                  key={m.id}
                  tournament={tournament}
                  slot={m}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
