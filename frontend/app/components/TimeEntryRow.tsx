import { Edit } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import { formatTime } from '../../../common/utils/time'
import { formatLapTimestamp } from '../utils/date'
import { Button } from './Button'

type TableRowProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLTableRowElement>,
  HTMLTableRowElement
>

export type GapType = 'leader' | 'interval'

function PositionBadgePart({ position }: Readonly<{ position?: number }>) {
  return (
    <td
      className={twMerge(
        'font-kh-interface flex size-8 items-center justify-center rounded uppercase',
        position === 1 ? 'bg-accent' : 'text-label-muted'
      )}
      aria-label={`#${position}`}>
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

function TimePart({ duration }: Readonly<{ duration?: number | null }>) {
  const label = duration ? formatTime(duration).replace(/^0/, '') : 'DNF'
  return (
    <td className={`font-f1-italic items-center uppercase tabular-nums`}>
      {label}
    </td>
  )
}

function DatePart({ timestamp }: Readonly<{ timestamp?: Date | string }>) {
  if (!timestamp) return null
  return (
    <td className='text-label-muted text-xs uppercase tabular-nums tracking-widest'>
      {formatLapTimestamp(timestamp)}
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
        'font-f1-italic text-label-muted flex items-center text-sm uppercase tabular-nums'
      }>
      {isPlaceholder ? (
        <Button
          type='button'
          variant='tertiary'
          size='sm'
          state={onToggle ? undefined : 'default'}
          onClick={onToggle}
          className='text-label-muted/50 rounded-md px-2 py-1 normal-case hover:bg-white/10 hover:text-white hover:no-underline'
          aria-label='Toggle gap display'
          title='Toggle gap display'>
          {label}
        </Button>
      ) : (
        <p className='px-2'>{label}</p>
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
  showGap = true,
  showDate = false,
  dateValue,
  highlighted = false,
  onEdit,
  canEdit = false,
  ...rest
}: Readonly<
  TableRowProps & {
    position?: number
    lapTime: LeaderboardEntry
    gapType?: GapType
    onToggleGapType?: () => void
    showGap?: boolean
    showDate?: boolean
    dateValue?: Date | string
    highlighted?: boolean
    onEdit?: () => void
    canEdit?: boolean
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
      gap: showGap && width >= 270,
      date: showDate && width >= 700,
    }
  }, [width, showGap, showDate])

  const name = useMemo(() => {
    if (width <= 400)
      return (
        lapTime.user.shortName ??
        (lapTime.user.lastName ?? lapTime.user.firstName).slice(0, 3)
      )
    return lapTime.user.lastName ?? lapTime.user.firstName
  }, [width])

  return (
    <tr
      ref={containerRef}
      className={twMerge(
        'flex items-center gap-2',
        highlighted ? 'bg-accent/10 ring-accent/40 rounded-md ring-1' : '',
        className
      )}
      title={
        lapTime.comment ??
        `${name} - ${lapTime.duration ? formatTime(lapTime.duration) : 'DNF'} - ${formatLapTimestamp(lapTime.createdAt)}`
      }
      role='row'
      {...rest}>
      <PositionBadgePart position={position} />
      <NameCellPart name={name} hasComment={!!lapTime.comment} />

      {canEdit && (
        <td className='ml-auto pl-2'>
          <Button
            type='button'
            variant='tertiary'
            size='sm'
            onClick={onEdit}
            className='rounded-md p-2 hover:bg-white/10'
            title='Edit lap time'
            aria-label='Edit lap time'>
            <Edit size={16} />
          </Button>
        </td>
      )}

      {show.date && <DatePart timestamp={dateValue ?? lapTime.createdAt} />}

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
