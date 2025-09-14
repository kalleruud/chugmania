import type { Leaderboard } from '@chugmania/common/models/leaderboard.js'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import TimeEntryRow, { type GapType } from './TimeEntryRow'

type TableProps = React.DetailedHTMLProps<
  React.TableHTMLAttributes<HTMLTableElement>,
  HTMLTableElement
>

export default function LeaderboardView({
  entries,
  className,
  ...rest
}: Readonly<TableProps & { entries: Leaderboard['entries'] }>) {
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
    <div className={className} {...rest}>
      <table className='w-full table-auto'>
        <tbody>
          {entries.map(t => (
            <TimeEntryRow
              key={t.id}
              lapTime={t}
              gapType={gapType}
              onToggleGapType={() =>
                setGapType(prev => (prev === 'leader' ? 'gap' : 'leader'))
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
