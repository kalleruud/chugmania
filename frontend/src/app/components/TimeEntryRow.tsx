import { useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type { LeaderboardEntry } from '../../../../common/models/timeEntry'
import { formatTime } from '../../../../common/utils/time'

type TableRowProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLTableRowElement>,
  HTMLTableRowElement
>

export type GapType = 'leader' | 'interval'

function PositionBadgePart({ position }: Readonly<{ position?: number }>) {
  return (
    <td
      className={
        'text-label-muted font-f1 flex items-center justify-center uppercase'
      }
      aria-label={`#${position}`}
    >
      <span>{position}</span>
    </td>
  )
}

function NameCellPart({
  name,
  hasComment = false,
}: Readonly<{ name: string; hasComment: boolean }>) {
  return (
    <td className='font-f1-bold mr-auto flex gap-1 truncate uppercase'>
      {name}
      {hasComment && <span className='text-label-muted'> *</span>}
    </td>
  )
}

function TimePart({ duration }: Readonly<{ duration: number }>) {
  return (
    <td className={`font-f1-italic items-center uppercase tabular-nums`}>
      {formatTime(duration).replace(/^0/, '')}
    </td>
  )
}

function GapPart({
  gap,
  gapType = 'leader',
  onToggle,
}: Readonly<{
  gap?: LeaderboardEntry['gap']
  gapType?: GapType
  onToggle?: () => void
}>) {
  const duration = gapType === 'leader' ? gap?.leader : gap?.previous
  const isPlaceholder = !duration
  const label = isPlaceholder
    ? gapType.toUpperCase()
    : '+' + formatTime(duration, true)

  return (
    <td
      className={
        'font-f1-italic text-label-muted items-center text-sm uppercase tabular-nums'
      }
    >
      {isPlaceholder ? (
        <button
          type='button'
          onClick={onToggle}
          className='rounded-md px-2 py-1 transition hover:cursor-pointer hover:bg-white/10 hover:text-white hover:outline-none hover:ring-1 hover:ring-white/30'
          aria-label='Toggle gap display'
          title='Toggle gap display'
        >
          {label}
        </button>
      ) : (
        label
      )}
    </td>
  )
}

export default function TimeEntryRow({
  lapTime,
  position = lapTime.gap.position,
  gapType = 'leader',
  className,
  onToggleGapType,
  ...rest
}: Readonly<
  TableRowProps & {
    position?: number
    lapTime: LeaderboardEntry
    gapType?: GapType
    onToggleGapType: () => void
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
      gap: width >= 270,
      comment: width >= 700,
    }
  }, [width])

  return (
    <tr
      ref={containerRef}
      className={twMerge('flex items-center gap-3 py-1', className)}
      title={
        lapTime.comment ??
        `${lapTime.user.name} - ${formatTime(lapTime.duration)}`
      }
      role='row'
      {...rest}
    >
      <PositionBadgePart position={position} />
      <NameCellPart
        name={lapTime.user.shortName ?? lapTime.user.name.slice(0, 3)}
        hasComment={!!lapTime.comment}
      />

      {show.gap && (
        <GapPart
          gap={lapTime.gap}
          gapType={gapType}
          onToggle={onToggleGapType}
        />
      )}
      {show.time && <TimePart duration={lapTime.duration} />}
    </tr>
  )
}
