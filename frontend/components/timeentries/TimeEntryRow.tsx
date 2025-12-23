import { useData } from '@/contexts/DataContext'
import type { LeaderboardEntryGap, TimeEntry } from '@common/models/timeEntry'
import { formatTime } from '@common/utils/time'
import { MinusIcon } from '@heroicons/react/24/solid'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'

export type GapType = 'leader' | 'interval'

type TimeEntryRowProps = BaseRowProps<TimeEntry> & {
  position?: number | null
  gap?: LeaderboardEntryGap
  gapType?: GapType
  onChangeGapType: () => void
}

const breakpoints = {
  none: 0,
  sm: 180,
  md: 270,
  lg: 360,
  xl: 640,
}

function PositionBadgePart({
  position,
}: Readonly<{ position: TimeEntryRowProps['position'] }>) {
  return (
    <div
      className={twMerge(
        'font-kh-interface flex w-6 flex-none items-center justify-center rounded-sm uppercase'
      )}
      aria-label={position ? `#${position}` : 'DNF'}>
      {position ? (
        <span className='text-primary'>{position}</span>
      ) : (
        <MinusIcon className='text-muted-foreground' />
      )}
    </div>
  )
}

export function NameCellPart({
  name,
  hasComment = false,
  className,
  ...props
}: Readonly<
  {
    name: string
    hasComment?: boolean
  } & ComponentProps<'div'>
>) {
  return (
    <div
      className={twMerge('font-f1-bold truncate uppercase', className)}
      {...props}>
      {name}
      {hasComment && <span className='text-primary'> *</span>}
    </div>
  )
}

function TimePart({ duration }: Readonly<{ duration?: number | null }>) {
  const isDNF = !duration
  const label = duration ? formatTime(duration).replace(/^0/, '') : 'DNF'
  return (
    <div
      className={twMerge(
        'font-f1-italic items-center uppercase tabular-nums',
        isDNF ? 'text-muted-foreground' : ''
      )}>
      {label}
    </div>
  )
}

function GapPart({
  gap,
  gapType = 'leader',
}: Readonly<{
  gap: LeaderboardEntryGap
  gapType?: GapType
  onChangeGapType: () => void
}>) {
  const duration = gapType === 'leader' ? gap.leader : gap.previous

  const label =
    gap.position === 1
      ? gapType.toUpperCase()
      : '+' + formatTime(duration ?? 0, true)

  return (
    <div
      className={
        'font-f1-italic text-muted-foreground flex items-center justify-end truncate text-sm uppercase tabular-nums'
      }>
      {label}
    </div>
  )
}

export default function TimeEntryRow({
  className,
  item: lapTime,
  gap,
  gapType,
  onChangeGapType,
  highlight,
  ...rest
}: Readonly<TimeEntryRowProps>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(breakpoints.md)
  const { users } = useData()
  const userInfo = users ? users.find(u => u.id === lapTime.user) : null

  const isDNF = !lapTime.duration

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

  const name = useMemo(() => {
    if (width <= breakpoints.md)
      return (
        userInfo?.shortName ??
        (userInfo?.lastName ?? userInfo?.firstName)?.slice(0, 3) ??
        'N/A'
      )
    return userInfo?.lastName ?? userInfo?.firstName ?? 'N/A'
  }, [width])

  const show = useMemo(() => {
    return {
      time: width >= breakpoints.none,
      pos: width >= breakpoints.sm,
      gap: width >= breakpoints.lg,
      date: width >= breakpoints.xl,
    }
  }, [width])

  return (
    <div
      ref={containerRef}
      className={twMerge(
        'hover:bg-foreground/5 flex cursor-pointer items-center gap-4 rounded-md',
        highlight && 'bg-foreground/3',
        isDNF && 'opacity-50',
        className
      )}
      title={lapTime.comment ?? undefined}
      {...rest}>
      {show.pos && <PositionBadgePart position={gap?.position} />}
      <NameCellPart
        name={name}
        hasComment={!!lapTime.comment}
        className={twMerge('mr-auto', isDNF && 'text-muted-foreground')}
      />

      {show.gap && gap && (
        <GapPart
          gap={gap}
          gapType={gapType}
          onChangeGapType={onChangeGapType}
        />
      )}
      {show.time && <TimePart duration={lapTime.duration} />}
    </div>
  )
}
