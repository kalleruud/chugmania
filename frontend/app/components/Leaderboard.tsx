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
  disabled = false,
  className,
  ...rest
}: Readonly<
  TableProps & { entries: Leaderboard['entries']; disabled: boolean }
>) {
  const [gapType, setGapType] = useState<GapType>('leader')

  if (!entries.length) {
    return (
      <div
        className={twMerge(
          'text-label-muted font-f1-italic flex size-full items-center justify-center p-4 text-sm',
          className
        )}
      >
        No entries available
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'flex w-full',
        disabled ? 'pointer-events-none' : '',
        className
      )}
      {...rest}
    >
      <table className='flex w-full table-auto'>
        <tbody className='flex w-full flex-col'>
          {entries.map(t => (
            <TimeEntryRow
              key={t.id}
              lapTime={t}
              gapType={gapType}
              disabled={disabled}
              onToggleGapType={() =>
                setGapType(prev => (prev === 'leader' ? 'interval' : 'leader'))
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
