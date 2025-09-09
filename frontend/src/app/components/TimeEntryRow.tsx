import type { LeaderboardEntry } from '@chugmania/common/models/timeEntry.js'

export type LapTimeRowProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> & {
  position?: number
  lapTime: LeaderboardEntry
  showTrack?: boolean
}

export default function TimeEntryRow({
  position,
  lapTime,
  showTrack = false,
}: Readonly<LapTimeRowProps>) {
  // TODO: Implement LapTimeRow component
  return null
}
