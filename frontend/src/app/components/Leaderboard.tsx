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
    return <div>No entries available</div>
  }

  return (
    <table className={twMerge('w-full rounded-lg', className)} {...rest}>
      <tbody>
        {entries.map(t => (
          <TimeEntryRow key={t.id} lapTime={t} />
        ))}
      </tbody>
    </table>
  )
}
