import type { Leaderboard } from '@chugmania/common/models/leaderboard.js'
import { twMerge } from 'tailwind-merge'
import TimeEntryRow from './TimeEntryRow'

type TableProps = React.DetailedHTMLProps<
  React.TableHTMLAttributes<HTMLTableElement>,
  HTMLTableElement
>

export default function LeaderboardView({
  entries,
  className,
  ...rest
}: Readonly<TableProps & { entries: Leaderboard['entries'] }>) {
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
            <TimeEntryRow key={t.id} lapTime={t} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
