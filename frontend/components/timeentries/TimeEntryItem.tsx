import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react'
import { twMerge } from 'tailwind-merge'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import { formatTime } from '../../../common/utils/time'
import { Button } from '../ui/button'

type TimeEntryItemProps = {
  position?: number | null
  lapTime: LeaderboardEntry
  gapType?: GapType
  onChangeGapType: () => void
} & ComponentProps<'div'>

export default function TimeEntryItem(props: Readonly<TimeEntryItemProps>) {
  return <TimeEntryRow {...props} />
}

export type GapType = 'leader' | 'interval'

function PositionBadgePart({
  position,
}: Readonly<{ position: TimeEntryItemProps['position'] }>) {
  if (position === null) return null
  return (
    <div
      className={twMerge(
        'font-kh-interface text-primary flex w-6 items-center justify-center rounded-sm uppercase'
      )}
      aria-label={`#${position}`}>
      <span>{position}</span>
    </div>
  )
}

function NameCellPart({
  name,
  hasComment = false,
}: Readonly<{ name: string; hasComment: boolean } & ComponentProps<'div'>>) {
  return (
    <div className='font-f1-bold mr-auto truncate uppercase'>
      {name}
      {hasComment && <span className='text-primary'> *</span>}
    </div>
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

function GapPart({
  gap,
  gapType = 'leader',
  onChangeGapType,
}: Readonly<{
  gap?: LeaderboardEntry['gap']
  gapType?: GapType
  onChangeGapType: () => void
}>) {
  const duration = gapType === 'leader' ? gap?.leader : gap?.previous
  const isLeader = !duration
  const label = isLeader
    ? gapType.toUpperCase()
    : '+' + formatTime(duration, true)

  return (
    <td
      className={
        'font-f1-italic text-muted-foreground flex w-24 items-center justify-end text-sm uppercase tabular-nums'
      }>
      {isLeader ? (
        <Button
          variant='ghost'
          size='sm'
          onClick={onChangeGapType}
          className='text-muted-foreground/50'>
          {label}
        </Button>
      ) : (
        <p className='px-2'>{label}</p>
      )}
    </td>
  )
}

function TimeEntryRow({
  lapTime,
  position = lapTime.gap.position,
  gapType,
  onChangeGapType,
  className,
  ...rest
}: Readonly<TimeEntryItemProps>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const { user: loggedInUser } = useAuth()
  const { users } = useData()
  const userInfo = users ? users[lapTime.user] : null

  const breakpoints = {
    none: 0,
    sm: 180,
    md: 270,
    lg: 420,
    xl: 640,
  }

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
    if (width <= breakpoints.lg)
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
      gap: width >= breakpoints.md,
      date: width >= breakpoints.xl,
    }
  }, [width])

  return (
    <div
      ref={containerRef}
      {...rest}
      className={twMerge(
        'aansition-colors flex cursor-pointer items-center gap-2 rounded-md hover:bg-white/5',
        loggedInUser && loggedInUser?.id === userInfo?.id
          ? 'bg-accent/10 ring-accent/40 ring-1'
          : '',
        className
      )}
      title={lapTime.comment ?? undefined}>
      {show.pos && <PositionBadgePart position={position} />}
      <NameCellPart name={name} hasComment={!!lapTime.comment} />

      {show.gap && (
        <GapPart
          gap={lapTime.gap}
          gapType={gapType}
          onChangeGapType={onChangeGapType}
        />
      )}
      {show.time && <TimePart duration={lapTime.duration} />}
    </div>
  )
}
