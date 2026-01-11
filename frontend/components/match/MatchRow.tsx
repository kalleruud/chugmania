import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { getRoundName } from '@/lib/utils'
import type { EditMatchRequest, Match, MatchSide } from '@common/models/match'
import type {
  TournamentMatch,
  TournamentWithDetails,
} from '@common/models/tournament'
import type { UserInfo } from '@common/models/user'
import { formatTrackName } from '@common/utils/track'
import { CalendarIcon, MinusIcon } from '@heroicons/react/24/solid'
import type { ComponentProps } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import { NameCellPart } from '../timeentries/TimeEntryRow'
import { Badge } from '../ui/badge'
import { Label } from '../ui/label'

export type MatchRowProps = BaseRowProps<Match | undefined> & {
  tournamentMatch?: TournamentMatch
  tournament?: TournamentWithDetails
  index?: number
  hideTrack?: boolean
  isReadOnly?: boolean
}

function getUserPlaceholderString(
  tournamentMatch: TournamentMatch | undefined,
  side: MatchSide,
  groupNumber: number | undefined,
  sourceMatchName: string | undefined
): string {
  if (!tournamentMatch) return loc.no.match.unknownUser

  const sourceGroup =
    side === 'A' ? tournamentMatch.sourceGroupA : tournamentMatch.sourceGroupB
  const sourceGroupRank =
    side === 'A'
      ? tournamentMatch.sourceGroupARank
      : tournamentMatch.sourceGroupBRank
  const sourceProgression =
    side === 'A'
      ? tournamentMatch.sourceMatchAProgression
      : tournamentMatch.sourceMatchBProgression

  if (sourceGroup && sourceGroupRank !== null && groupNumber !== undefined) {
    return loc.no.tournament.sourceGroupPlaceholder(
      groupNumber,
      sourceGroupRank
    )
  }

  if (sourceMatchName && sourceProgression) {
    return loc.no.tournament.sourceMatchPlaceholder(
      sourceMatchName,
      sourceProgression
    )
  }

  return loc.no.match.unknownUser
}

export default function MatchRow({
  className,
  item: match,
  tournamentMatch,
  tournament,
  index,
  highlight,
  hideTrack,
  isReadOnly,
  ...rest
}: Readonly<MatchRowProps>) {
  const { users, tracks, sessions } = useData()
  const { socket } = useConnection()
  const { isLoggedIn, loggedInUser } = useAuth()

  const roundName = tournamentMatch
    ? getRoundName(tournamentMatch.round ?? 0, tournamentMatch.bracket)
    : undefined

  const matchName =
    index === undefined || !roundName
      ? undefined
      : loc.no.tournament.bracketMatchName(roundName, index + 1)

  const track = match?.track
    ? tracks?.find(t => t.id === match?.track)
    : undefined
  const session = match?.session
    ? sessions?.find(s => s.id === match?.session)
    : undefined

  const user1 = match?.user1
    ? users?.find(u => u.id === match?.user1)
    : undefined
  const user2 = match?.user2
    ? users?.find(u => u.id === match?.user2)
    : undefined

  const groupNumberA = tournament?.groups.find(
    g => g.id === tournamentMatch?.sourceGroupA
  )?.number
  const groupNumberB = tournament?.groups.find(
    g => g.id === tournamentMatch?.sourceGroupB
  )?.number

  const allTournamentMatches = tournament?.rounds.flatMap(r => r.matches)
  const sourceMatchA = allTournamentMatches?.find(
    m => m.id === tournamentMatch?.sourceMatchA
  )
  const sourceMatchB = allTournamentMatches?.find(
    m => m.id === tournamentMatch?.sourceMatchB
  )
  const sourceMatchNameA = sourceMatchA
    ? loc.no.tournament.bracketMatchName(
        getRoundName(sourceMatchA.round ?? 0, sourceMatchA.bracket),
        sourceMatchA.position + 1
      )
    : undefined
  const sourceMatchNameB = sourceMatchB
    ? loc.no.tournament.bracketMatchName(
        getRoundName(sourceMatchB.round ?? 0, sourceMatchB.bracket),
        sourceMatchB.position + 1
      )
    : undefined

  const canEdit = !isReadOnly && isLoggedIn && loggedInUser.role !== 'user'

  const isCancelled = match?.status === 'cancelled'
  const isCompleted = match?.status === 'completed'
  const isPlanned = match?.status === 'planned'

  function handleSetWinner(userId: string) {
    if (!canEdit || !match || isReadOnly) return

    const isWinner = match.winner === userId
    const newWinner = isWinner ? null : userId
    const newStatus = isWinner ? 'planned' : 'completed'

    const payload: EditMatchRequest = {
      type: 'EditMatchRequest',
      id: match.id,
      winner: newWinner,
      status: newStatus,
    }

    toast.promise(
      socket.emitWithAck('edit_match', payload).then(r => {
        if (!r.success) throw new Error(r.message)
      }),
      loc.no.match.toast.update
    )
  }

  function handleCancel() {
    if (!canEdit || !match || isReadOnly) return

    const payload: EditMatchRequest = {
      type: 'EditMatchRequest',
      id: match.id,
      status: 'cancelled',
      winner: null,
    }

    toast.promise(
      socket.emitWithAck('edit_match', payload).then(r => {
        if (!r.success) throw new Error(r.message)
      }),
      loc.no.match.toast.update
    )
  }

  return (
    <div
      className={twMerge(
        'group relative flex items-center justify-between rounded-sm p-2 transition-colors',
        !isReadOnly && 'hover:bg-foreground/15 hover:cursor-pointer',
        isCancelled && 'text-muted-foreground opacity-33',
        className,
        highlight && 'bg-foreground/13'
      )}
      {...rest}>
      <div className='grid w-full items-center gap-1'>
        {matchName && (
          <span className='text-muted-foreground w-full text-center text-xs font-medium'>
            {matchName}
          </span>
        )}

        <div
          className={twMerge(
            'flex w-full items-center justify-center gap-2',
            isCancelled && 'line-through'
          )}>
          <UserCell
            className='flex-1 text-right'
            user={user1}
            placeholder={getUserPlaceholderString(
              tournamentMatch,
              'A',
              groupNumberA,
              sourceMatchNameA
            )}
            isWinner={!!match?.winner && match?.winner === match?.user1}
            onClick={() => user1 && handleSetWinner(user1.id)}
            disabled={!canEdit || isCancelled || match?.status !== 'planned'}
            isCancelled={isCancelled}
            isCompleted={isCompleted}
          />

          <span
            className={twMerge(
              'text-muted-foreground/50 font-kh-interface mb-1 text-sm font-black',
              isCancelled && 'line-through'
            )}>
            {loc.no.match.vs}
          </span>

          <UserCell
            className='flex-1'
            user={user2}
            placeholder={getUserPlaceholderString(
              tournamentMatch,
              'B',
              groupNumberB,
              sourceMatchNameB
            )}
            isWinner={!!match?.winner && match?.winner === match?.user2}
            onClick={() => user2 && handleSetWinner(user2.id)}
            disabled={!canEdit || isCancelled || match?.status !== 'planned'}
            isCancelled={isCancelled}
            isCompleted={isCompleted}
          />
        </div>

        <div
          className={twMerge(
            'flex items-center justify-center gap-2',
            (!track || hideTrack) && !session && !match?.stage && 'hidden'
          )}>
          {track && !hideTrack && (
            <div className='flex items-center gap-2'>
              <span
                className={twMerge(
                  'font-kh-interface tabular-nums',
                  isCancelled && 'line-through'
                )}>
                <span className='text-primary mr-1'>#</span>
                {formatTrackName(track.number)}
              </span>
            </div>
          )}

          {session && (
            <div className='text-muted-foreground flex items-center gap-1'>
              <CalendarIcon className='size-3' />
              <Label
                className={twMerge('text-xs', isCancelled && 'line-through')}>
                {session.name}
              </Label>
            </div>
          )}

          {match?.stage && (
            <Badge
              variant='outline'
              className={twMerge(
                'text-muted-foreground',
                isCancelled && 'line-through'
              )}>
              {loc.no.match.stage[match.stage]}
            </Badge>
          )}
        </div>
      </div>

      <div className='absolute right-0 flex items-center'>
        {canEdit && isPlanned && (
          <button
            title={loc.no.match.cancel}
            className={twMerge(
              'text-muted-foreground m-2 hidden p-2 transition-colors',
              !isReadOnly &&
                'hover:text-primary-foreground hover:bg-muted hover:cursor-pointer hover:rounded-sm group-hover:block'
            )}
            onClick={e => {
              e.stopPropagation()
              handleCancel()
            }}>
            <MinusIcon className='size-4' />
          </button>
        )}

        {isPlanned && (
          <span
            className={twMerge(
              'bg-primary mr-5 size-2 animate-pulse rounded-full',
              !isReadOnly && 'group-hover:hidden'
            )}
          />
        )}
      </div>
    </div>
  )
}

function UserCell({
  user,
  isWinner,
  placeholder,
  onClick,
  disabled,
  isCancelled,
  isCompleted,
  ...props
}: Readonly<
  {
    user: UserInfo | undefined
    placeholder?: string
    isWinner: boolean
    onClick?: () => void
    disabled?: boolean
    isCancelled: boolean
    isCompleted: boolean
  } & ComponentProps<'div'>
>) {
  return (
    <div {...props}>
      <button
        type='button'
        disabled={disabled}
        onClick={e => {
          e.stopPropagation()
          onClick?.()
        }}
        className={twMerge(
          'border-b-2 px-1 transition-all',
          !isCancelled &&
            !isCompleted &&
            user &&
            'hover:border-primary hover:border-b-2',
          !isWinner && isCompleted && 'text-muted-foreground',
          isWinner && 'border-primary',
          !user && 'text-muted-foreground opacity-50',
          disabled && 'pointer-events-none',
          isCancelled && 'line-through'
        )}>
        <NameCellPart
          name={
            user?.shortName ??
            user?.lastName ??
            user?.firstName ??
            placeholder ??
            loc.no.match.unknownUser
          }
        />
      </button>
    </div>
  )
}
