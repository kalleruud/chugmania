import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type { Leaderboard } from '../../../common/models/leaderboard'
import TimeEntryRow, { type GapType } from './TimeEntryRow'

type TableProps = React.DetailedHTMLProps<
  React.TableHTMLAttributes<HTMLTableElement>,
  HTMLTableElement
>

export default function LeaderboardView({
  entries,
  compact = false,
  className,
  highlightedUserId,
  onEditLapTime,
  canEditLapTime,
  ...rest
}: Readonly<
  TableProps & {
    entries: Leaderboard['entries']
    compact?: boolean
    highlightedUserId?: string
    onEditLapTime?: (entry: Leaderboard['entries'][0]) => void
    canEditLapTime?: (entry: Leaderboard['entries'][0]) => boolean
  }
>) {
  const [gapType, setGapType] = useState<GapType>('interval')

  if (!entries.length) {
    return (
      <div
        className={twMerge(
          'text-label-muted font-f1-italic flex size-full items-center justify-center p-4 text-sm',
          className
        )}>
        No entries available
      </div>
    )
  }

  return (
    <div className={'flex w-full'} {...rest}>
      <table className='flex w-full table-auto'>
        <tbody className={twMerge('flex w-full flex-col gap-1', className)}>
          {entries.map(t => (
            <TimeEntryRow
              key={t.id}
              lapTime={t}
              gapType={gapType}
              className={compact ? '' : 'py-1'}
              highlighted={highlightedUserId === t.user}
              onToggleGapType={() =>
                setGapType(prev => (prev === 'leader' ? 'interval' : 'leader'))
              }
              canEdit={canEditLapTime?.(t) ?? false}
              onEdit={() => onEditLapTime?.(t)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
