import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { TournamentWithDetails } from '@common/models/tournament'
import { TrophyIcon } from '@heroicons/react/24/solid'
import GroupCard from './GroupCard'
import TournamentBracket from './TournamentBracket'

type TournamentCardProps = {
  tournament: TournamentWithDetails
}

export default function TournamentCard({
  tournament,
}: Readonly<TournamentCardProps>) {
  const eliminationTypeLabel =
    tournament.eliminationType === 'single'
      ? 'Single Elimination'
      : 'Double Elimination'

  return (
    <Card className='w-full'>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            <TrophyIcon className='text-primary size-8' />
            <div>
              <CardTitle className='text-2xl'>{tournament.name}</CardTitle>
              {tournament.description && (
                <p className='text-muted-foreground text-sm'>
                  {tournament.description}
                </p>
              )}
            </div>
          </div>
          <Badge variant='outline'>{eliminationTypeLabel}</Badge>
        </div>
      </CardHeader>

      <CardContent className='space-y-6'>
        {tournament.groups.length > 0 && (
          <div className='space-y-4'>
            <h3 className='font-f1-bold text-lg uppercase'>Group Stage</h3>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              {tournament.groups.map(group => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          </div>
        )}

        {tournament.tournamentMatches.length > 0 && (
          <>
            <Separator />
            <div className='space-y-4'>
              <h3 className='font-f1-bold text-lg uppercase'>Bracket</h3>
              <TournamentBracket
                tournamentMatches={tournament.tournamentMatches}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
