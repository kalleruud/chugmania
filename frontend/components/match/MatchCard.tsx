import { useData } from '@/contexts/DataContext'
import { useActiveEntries } from '@/hooks/useActiveEntries'
import { useMatch } from '@/hooks/useMatch'
import loc from '@common/locale/locales'
import type { UserInfo } from '@common/models/user'
import { getUserFullName } from '@common/models/user'
import { formatTime } from '@common/utils/time'
import { isInactiveFinalReset, stageName } from '@common/utils/tournament'
import { twMerge } from 'tailwind-merge'
import NowBadge from '../now/NowBadge'
import NowButton from '../now/NowButton'
import { NameCellPart } from '../timeentries/TimeEntryRow'
import { TrackRow } from '../track/TrackRow'
import { Badge } from '../ui/badge'
import type { MatchProps } from './MatchProps'

export default function MatchCard({
  item: match,
  className,
  hideTrack,
  children,
  ...props
}: Readonly<MatchProps>) {
  const { users, tracks } = useData()
  const { canSetResult, toggleWinner } = useMatch(match)
  const now = useActiveEntries().getNow('match', match.id)
  const user1 = users?.find(user => user.id === match.user1)
  const user2 = users?.find(user => user.id === match.user2)
  const track =
    match.track === null
      ? null
      : tracks?.find(track => track.id === match.track)
  const isCancelled = match.status === 'cancelled' && !match.tournament?.awarded
  const isCompleted =
    match.status === 'completed' || !!match.tournament?.awarded
  const canChooseWinner = canSetResult && match.status === 'planned'
  const showTrack = track !== undefined && !hideTrack
  const name = (user: UserInfo | undefined, slot: string | undefined) =>
    user ? displayName(user) : slot || loc.no.match.unknownUser

  return (
    <div
      className={twMerge(
        'group relative flex cursor-pointer flex-col gap-3 rounded-sm p-3 transition-colors sm:p-4',
        isCancelled && 'text-muted-foreground opacity-33',
        className,
        now && 'border-l-2 border-primary bg-primary/5 hover:bg-primary/8'
      )}
      {...props}>
      <div className='flex items-center gap-2'>
        {now && <NowBadge now={now} />}
        {match.stage && (
          <Badge variant='outline' className='text-muted-foreground'>
            {match.tournament?.label ?? stageName(match.stage)}
          </Badge>
        )}
        {match.tournament?.awarded && (
          <Badge>{loc.no.tournament.awarded}</Badge>
        )}
        {isInactiveFinalReset(match) && match.status === 'planned' && (
          <Badge>{loc.no.tournament.conditional}</Badge>
        )}
        <span className='mr-auto' />
        {!isInactiveFinalReset(match) && (
          <NowButton
            kind='match'
            entry={match}
            subject={`${name(user1, match.tournament?.slot1)} ${loc.no.match.vs} ${name(user2, match.tournament?.slot2)}`}
          />
        )}
      </div>
      <div className='flex items-start gap-4 py-1'>
        <Player
          user={user1}
          slotLabel={match.tournament?.slot1}
          isWinner={!!match.winner && match.winner === match.user1}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
          disabled={!canChooseWinner}
          onSelect={() => user1 && toggleWinner(user1.id)}
          className='text-right'
        />
        <span className='mb-1 font-kh-interface text-2xl font-black text-primary'>
          {loc.no.match.vs}
        </span>
        <Player
          user={user2}
          slotLabel={match.tournament?.slot2}
          isWinner={!!match.winner && match.winner === match.user2}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
          disabled={!canChooseWinner}
          onSelect={() => user2 && toggleWinner(user2.id)}
        />
      </div>
      {(showTrack || match.duration !== null || match.comment) && (
        <div className='flex flex-col gap-3 border-t border-primary/20 pt-3'>
          {showTrack && <TrackRow item={track} hideLink className='p-0' />}
          {(match.duration !== null || match.comment) && (
            <dl className='grid gap-3 sm:grid-cols-2'>
              {match.duration !== null && (
                <div>
                  <dt className='text-sm text-muted-foreground'>
                    {loc.no.match.duration}
                  </dt>
                  <dd className='font-kh-interface text-xl tabular-nums'>
                    {formatTime(match.duration)}
                  </dd>
                </div>
              )}
              {match.comment && (
                <div>
                  <dt className='text-sm text-muted-foreground'>
                    {loc.no.match.form.comment}
                  </dt>
                  <dd className='wrap-break-word whitespace-pre-wrap'>
                    {match.comment}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

function Player({
  user,
  slotLabel,
  isWinner,
  isCompleted,
  isCancelled,
  disabled,
  onSelect,
  className,
}: Readonly<{
  user: UserInfo | undefined
  slotLabel?: string
  isWinner: boolean
  isCompleted: boolean
  isCancelled: boolean
  disabled: boolean
  onSelect: () => void
  className?: string
}>) {
  return (
    <div className={twMerge('min-w-0 flex-1', className)}>
      <button
        type='button'
        disabled={disabled}
        onClick={e => {
          e.stopPropagation()
          onSelect()
        }}
        className={twMerge(
          'max-w-full border-b-2 border-transparent px-1 [text-align:inherit] transition-all',
          !disabled && 'hover:border-primary',
          !isWinner && isCompleted && 'text-muted-foreground',
          isWinner && 'border-primary',
          !user && 'text-muted-foreground opacity-50',
          disabled && 'pointer-events-none',
          isCancelled && 'line-through'
        )}>
        <NameCellPart
          name={
            user ? displayName(user) : slotLabel || loc.no.match.unknownUser
          }
          className='overflow-visible text-base wrap-break-word whitespace-normal sm:text-2xl'
        />
      </button>
      {user && slotLabel && (
        <p className='mt-2 text-sm text-muted-foreground'>{slotLabel}</p>
      )}
    </div>
  )
}

function displayName(user: UserInfo): string {
  return user.shortName ?? getUserFullName(user)
}
