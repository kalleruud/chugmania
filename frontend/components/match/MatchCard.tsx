import { useData } from '@/contexts/DataContext'
import { useActiveEntries } from '@/hooks/useActiveEntries'
import { useMatch } from '@/hooks/useMatch'
import { getGoogleMapsUrl } from '@/lib/maps'
import loc from '@common/locale/locales'
import type { UserInfo } from '@common/models/user'
import { getUserFullName } from '@common/models/user'
import { formatDateWithYear, formatTimeOnly } from '@common/utils/date'
import { formatTime } from '@common/utils/time'
import { isInactiveFinalReset, stageName } from '@common/utils/tournament'
import { twMerge } from 'tailwind-merge'
import NowButton from '../now/NowButton'
import { NameCellPart } from '../timeentries/TimeEntryRow'
import { TrackRow } from '../track/TrackRow'
import { Badge } from '../ui/badge'
import type { MatchProps } from './MatchProps'

export default function MatchCard({
  item: match,
  className,
  highlight,
  hideTrack,
  compact,
  children,
  ...props
}: Readonly<MatchProps & { compact?: boolean }>) {
  const { users, tracks, sessions } = useData()
  const { canSetResult, toggleWinner } = useMatch(match)
  const now = useActiveEntries().getNow('match', match.id)
  const user1 = users?.find(user => user.id === match.user1)
  const user2 = users?.find(user => user.id === match.user2)
  const track =
    match.track === null
      ? null
      : tracks?.find(track => track.id === match.track)
  const session = sessions?.find(session => session.id === match.session)
  const sessionMapsUrl = getGoogleMapsUrl(session?.location)
  const isCancelled = match.status === 'cancelled' && !match.tournament?.awarded
  const isCompleted =
    match.status === 'completed' || !!match.tournament?.awarded
  const canChooseWinner = canSetResult && match.status === 'planned'

  return (
    <div
      className={twMerge(
        'group relative flex cursor-pointer flex-col rounded-sm transition-colors',
        compact ? 'gap-4 p-4 sm:p-6' : 'gap-6 p-6 sm:p-8',
        isCancelled && 'text-muted-foreground opacity-33',
        className,
        highlight &&
          'border border-primary/40 bg-primary/10 hover:bg-primary/12'
      )}
      {...props}>
      <div
        className={twMerge(
          'flex items-center gap-4',
          compact ? 'py-2' : 'py-4'
        )}>
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
      {match.stage && (
        <Badge variant='outline' className='self-center text-muted-foreground'>
          {match.tournament?.label ?? stageName(match.stage)}
        </Badge>
      )}
      <div className='flex flex-col gap-4 border-t border-primary/20 pt-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            {now && !compact && <Badge>{loc.no.activeEntry.now}</Badge>}
            {now?.source === 'override' && (
              <Badge variant='outline'>{loc.no.activeEntry.pinned}</Badge>
            )}
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground'>
              {loc.no.common.status[match.status]}
            </span>
            {!isInactiveFinalReset(match) && (
              <NowButton
                kind='match'
                entry={match}
                showLabel
                subject={`${user1 ? getUserFullName(user1) : (match.tournament?.slot1 ?? loc.no.match.unknownUser)} ${loc.no.match.vs} ${user2 ? getUserFullName(user2) : (match.tournament?.slot2 ?? loc.no.match.unknownUser)}`}
              />
            )}
          </div>
        </div>
        {track !== undefined && !hideTrack && (
          <TrackRow item={track} hideLink className='p-0' />
        )}
        {session && !compact && (
          <p className='text-sm text-muted-foreground'>
            {session.name} · {formatDateWithYear(session.date)} ·{' '}
            {formatTimeOnly(session.date)}
            {sessionMapsUrl && (
              <>
                {' · '}
                <a
                  href={sessionMapsUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-primary'>
                  {session.location}
                </a>
              </>
            )}
          </p>
        )}
        {(match.duration !== null || match.comment) && (
          <dl className='grid gap-4 sm:grid-cols-2'>
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
      {children}
      {match.tournament?.awarded && <Badge>{loc.no.tournament.awarded}</Badge>}
      {isInactiveFinalReset(match) && match.status === 'planned' && (
        <Badge>{loc.no.tournament.conditional}</Badge>
      )}
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
          'max-w-full border-b-2 border-transparent px-1 transition-all',
          !disabled && 'hover:border-primary',
          !isWinner && isCompleted && 'text-muted-foreground',
          isWinner && 'border-primary',
          !user && 'text-muted-foreground opacity-50',
          disabled && 'pointer-events-none',
          isCancelled && 'line-through'
        )}>
        <NameCellPart
          name={
            user ? getUserFullName(user) : slotLabel || loc.no.match.unknownUser
          }
          className='text-lg whitespace-normal sm:text-3xl'
        />
      </button>
      {user && slotLabel && (
        <p className='mt-2 text-sm text-muted-foreground'>{slotLabel}</p>
      )}
    </div>
  )
}
