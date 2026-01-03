import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { TournamentBracket } from '@backend/database/schema'
import type {
  TournamentMatch,
  TournamentWithDetails,
} from '@common/models/tournament'
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

export type GroupedBracket = {
  name: string // The value from the 'bracket' column
  rounds: {
    roundNumber: number
    matches: TournamentMatch[]
  }[]
}

export function MatchesGroupedByBracket(
  matches: TournamentMatch[]
): GroupedBracket[] {
  // keywords to help sort "Upper" brackets before "Lower" brackets
  const upperKeywords = ['winner', 'upper', 'group']
  const lowerKeywords = ['loser', 'lower']

  // Step 1: Group by Bracket Name, then by Round
  const groupedMap = matches.reduce((acc, match) => {
    const bracketName = match.bracket
    const roundNum = match.round ?? 0 // Handle null rounds if necessary, default to 0

    if (!acc.has(bracketName)) {
      acc.set(bracketName, new Map<number, TournamentMatch[]>())
    }

    const bracketRounds = acc.get(bracketName)!

    if (!bracketRounds.has(roundNum)) {
      bracketRounds.set(roundNum, [])
    }

    bracketRounds.get(roundNum)!.push(match)
    return acc
  }, new Map<string, Map<number, TournamentMatch[]>>())

  // Step 2: Convert Map to Array and Sort
  const result: GroupedBracket[] = Array.from(groupedMap.entries()).map(
    ([bracketName, roundsMap]) => {
      // Convert rounds map to array
      const rounds = Array.from(roundsMap.entries()).map(
        ([roundNumber, roundMatches]) => {
          // Sort matches within a specific round (optional, e.g., by ID or SourceRank)
          // Here we keep them as is or sort by ID for determinism
          return {
            roundNumber,
            matches: roundMatches,
          }
        }
      )

      // Sort rounds ascending (Top to Bottom: Round 1, Round 2...)
      rounds.sort((a, b) => a.roundNumber - b.roundNumber)

      return {
        name: bracketName,
        rounds,
      }
    }
  )

  // Step 3: Sort the Brackets (Upper/Winners first, then Lower/Losers)
  result.sort((a, b) => {
    const nameA = a.name.toLowerCase()
    const nameB = b.name.toLowerCase()

    const isAUpper = upperKeywords.some(k => nameA.includes(k))
    const isBUpper = upperKeywords.some(k => nameB.includes(k))
    const isALower = lowerKeywords.some(k => nameA.includes(k))
    const isBLower = lowerKeywords.some(k => nameB.includes(k))

    // If one is Upper and the other isn't, Upper comes first
    if (isAUpper && !isBUpper) return -1
    if (!isAUpper && isBUpper) return 1

    // If one is Lower and the other isn't, Lower comes last
    if (isALower && !isBLower) return 1
    if (!isALower && isBLower) return -1

    // Fallback: Alphabetical sort
    return nameA.localeCompare(nameB)
  })

  return result
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

          {MatchesGroupedByBracket(tournament.matches).map(bracket => (
            <div key={bracket.name}>
              <h4 className='font-f1-bold text-sm uppercase'>
                {
                  loc.no.tournament.bracketType[
                    bracket.name as TournamentBracket
                  ]
                }
              </h4>
              {bracket.rounds.toReversed().map(round => (
                <div key={round.roundNumber} className='flex flex-col gap-1'>
                  <h5 className='font-f1-bold text-xs uppercase'>
                    {round.roundNumber}
                  </h5>
                  {round.matches.map(match => (
                    <TournamentMatchRow key={match.id} item={match} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
