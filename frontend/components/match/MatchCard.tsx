import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import { useMatchResultActions } from '@/hooks/useMatchResultActions'
import loc from '@common/locale/locales'
import type { UserInfo } from '@common/models/user'
import { getUserFullName } from '@common/models/user'
import { formatDateWithYear, formatTimeOnly } from '@common/utils/date'
import { formatTime } from '@common/utils/time'
import { stageName } from '@common/utils/tournament'
import { MinusIcon } from '@heroicons/react/24/solid'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import { NameCellPart } from '../timeentries/TimeEntryRow'
import { TrackRow } from '../track/TrackRow'
import { Badge } from '../ui/badge'
import type { MatchProps } from './MatchProps'

export default function MatchCard({
  item: match,
  className,
  highlight,
  hideTrack,
  children,
  ...props
}: Readonly<MatchProps>) {
  const { socket } = useConnection()
  const { users, tracks, sessions } = useData()
  const { canSetResult, toggleWinner } = useMatchResultActions(match)
  const user1 = users?.find(user => user.id === match.user1)
  const user2 = users?.find(user => user.id === match.user2)
  const track = tracks?.find(track => track.id === match.track)
  const session = sessions?.find(session => session.id === match.session)
  const isCancelled = match.status === 'cancelled' && !match.tournament?.awarded
  const isCompleted =
    match.status === 'completed' || !!match.tournament?.awarded
  const canChooseWinner = canSetResult && match.status === 'planned'

  function handleCancel() {
    if (!canChooseWinner) return
    toast.promise(
      socket
        .emitWithAck('edit_match', {
          type: 'EditMatchRequest',
          id: match.id,
          status: 'cancelled',
          winner: null,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
        }),
      loc.no.match.toast.update
    )
  }

  return (
    <div
      className={twMerge(
        'group relative flex cursor-pointer flex-col gap-6 rounded-sm p-6 transition-colors sm:p-8',
        isCancelled && 'text-muted-foreground opacity-33',
        className,
        highlight &&
          'border border-primary/40 bg-primary/10 hover:bg-primary/12'
      )}
      {...props}>
      <div className='flex items-center gap-4 py-4'>
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
          <Badge>{loc.no.match.upNext}</Badge>
          <span className='text-sm text-muted-foreground'>
            {loc.no.match.status[match.status]}
          </span>
        </div>
        {track && !hideTrack && (
          <TrackRow item={track} hideLink className='p-0' />
        )}
        {session && (
          <p className='text-sm text-muted-foreground'>
            {session.name} · {formatDateWithYear(session.date)} ·{' '}
            {formatTimeOnly(session.date)}
            {session.location && ` · ${session.location}`}
          </p>
        )}
        <dl className='grid gap-4 sm:grid-cols-2'>
          <div>
            <dt className='text-sm text-muted-foreground'>
              {loc.no.match.duration}
            </dt>
            <dd className='font-kh-interface text-xl tabular-nums'>
              {match.duration === null
                ? loc.no.match.placeholder.none
                : formatTime(match.duration)}
            </dd>
          </div>
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
      </div>
      {children}
      {match.tournament?.awarded && <Badge>{loc.no.tournament.awarded}</Badge>}
      {match.tournament?.finalResetStatus === 'conditional' && (
        <Badge>{loc.no.tournament.conditional}</Badge>
      )}
      {match.tournament?.finalResetStatus === 'unneeded' && (
        <Badge>{loc.no.tournament.unneeded}</Badge>
      )}
      {canChooseWinner && (
        <button
          type='button'
          title={loc.no.match.cancel}
          className='absolute top-0 right-0 m-2 p-2 text-muted-foreground transition-colors hover:rounded-sm hover:bg-muted hover:text-primary-foreground'
          onClick={e => {
            e.stopPropagation()
            handleCancel()
          }}>
          <MinusIcon className='size-4' />
        </button>
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
