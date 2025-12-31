import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useData } from '@/contexts/DataContext'
import type { TournamentWithDetails } from '@common/models/tournament'
import type { ComponentProps } from 'react'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import MatchRow from '../match/MatchRow'
import GroupCard from './GroupCard'
import TournamentMatchPlaceholderRow from './TournamentMatchPlaceholderRow'

type TournamentCardProps = {
  tournament: TournamentWithDetails
  className?: string
} & ComponentProps<'div'>

export default function TournamentCard({
  tournament,
  className,
  ...props
}: Readonly<TournamentCardProps>) {
  const { matches } = useData()

  const groupedMatches = useMemo(() => {
    const grouped: Record<
      string,
      Record<number, typeof tournament.tournamentMatches>
    > = {}

    for (const tm of tournament.tournamentMatches) {
      if (tm.bracket === 'group') continue

      const bracketKey = tm.bracket
      if (!grouped[bracketKey]) {
        grouped[bracketKey] = {}
      }

      if (!grouped[bracketKey][tm.round]) {
        grouped[bracketKey][tm.round] = []
      }

      grouped[bracketKey][tm.round].push(tm)
    }

    for (const bracket in grouped) {
      for (const round in grouped[bracket]) {
        grouped[bracket][round].sort((a, b) => {
          if (a.name < b.name) return -1
          if (a.name > b.name) return 1
          return 0
        })
      }
    }

    return grouped
  }, [tournament.tournamentMatches])

  const sortedRounds = (
    rounds: Record<number, typeof tournament.tournamentMatches>
  ) => {
    return Object.keys(rounds)
      .map(Number)
      .sort((a, b) => b - a)
  }

  return (
    <Card className={twMerge('w-full', className)} {...props}>
      <CardHeader>
        <CardTitle>{tournament.name}</CardTitle>
        {tournament.description && (
          <CardDescription>{tournament.description}</CardDescription>
        )}
        <div className='text-muted-foreground text-sm'>
          {tournament.eliminationType === 'single'
            ? 'Single Elimination'
            : 'Double Elimination'}
        </div>
      </CardHeader>
      <CardContent className='flex flex-col gap-6'>
        {tournament.groups.length > 0 && (
          <div>
            <h3 className='mb-4 text-lg font-semibold'>Group Stage</h3>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {tournament.groups.map(group => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          </div>
        )}

        {Object.keys(groupedMatches).length > 0 && (
          <>
            <Separator />
            <div className='flex flex-col gap-6'>
              {Object.entries(groupedMatches).map(([bracket, rounds]) => (
                <div key={bracket}>
                  <h3 className='mb-4 text-lg font-semibold capitalize'>
                    {bracket} Bracket
                  </h3>
                  {sortedRounds(rounds).map(round => (
                    <div key={round} className='mb-4'>
                      <h4 className='text-muted-foreground mb-2 text-sm font-medium'>
                        Round {round}
                      </h4>
                      <div className='flex flex-col gap-1'>
                        {rounds[round].map(tm => {
                          if (tm.match) {
                            const match = matches?.find(m => m.id === tm.match)
                            if (match) {
                              return (
                                <MatchRow key={tm.id} item={match} hideTrack />
                              )
                            }
                          }
                          return (
                            <TournamentMatchPlaceholderRow
                              key={tm.id}
                              tournamentMatch={tm}
                              tournament={tournament}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
