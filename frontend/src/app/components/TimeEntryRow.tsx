import type { LeaderboardEntry } from '@chugmania/common/models/timeEntry.js'
import { formatTime } from '@chugmania/common/utils/time.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type TableRowProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLTableRowElement>,
  HTMLTableRowElement
>

function PositionBadgePart({ position }: Readonly<{ position?: number }>) {
  return (
    <td
      className={'text-label-muted flex items-center justify-center uppercase'}
      aria-label={`#${position}`}
    >
      <span>{position}</span>
    </td>
  )
}

function NameCellPart({ name }: Readonly<{ name: string }>) {
  return <td className='font-f1-bold flex-1 truncate uppercase'>{name}</td>
}

function TimePart({ duration }: Readonly<{ duration: number }>) {
  return (
    <td className={`font-f1-italic items-center tabular-nums`}>
      {formatTime(duration).replace(/^0/, '')}
    </td>
  )
}

function GapPart({ duration }: Readonly<{ duration: number }>) {
  return (
    <td
      className={`font-f1-italic text-label-muted items-center text-sm tabular-nums`}
    >
      {'+' + formatTime(duration, true)}
    </td>
  )
}

export default function TimeEntryRow({
  lapTime,
  position = lapTime.gap.position,
  showTrack = false,
  className,
  ...rest
}: Readonly<
  TableRowProps & {
    position?: number
    lapTime: LeaderboardEntry
    showTrack?: boolean
  }
>) {
  const containerRef = useRef<HTMLTableRowElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (typeof w === 'number') setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Priority-based visibility (no Tailwind breakpoints; reacts to actual width)
  // Baselines tuned for our row layout; adjust if design changes
  const show = useMemo(() => {
    return {
      time: width >= 0, // always
      gap: width >= 300,
      track: showTrack && width >= 520,
      comment: width >= 700,
    }
  }, [width, showTrack])

  return (
    <tr
      ref={containerRef}
      className={twMerge(
        'bg-background flex items-center gap-3 px-3 py-2',
        className
      )}
      role='row'
      {...rest}
    >
      <PositionBadgePart position={position} />
      <NameCellPart
        name={lapTime.user.shortName ?? lapTime.user.name.slice(0, 3)}
      />

      {show.gap && lapTime.gap.previous && (
        <GapPart duration={lapTime.gap.previous} />
      )}
      {show.time && <TimePart duration={lapTime.duration} />}
    </tr>
  )
}
