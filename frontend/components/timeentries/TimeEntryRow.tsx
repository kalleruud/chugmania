import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { MatchStatus } from '@common/models/match'
import type {
  GapType,
  LeaderboardEntryGap,
  TimeEntry,
} from '@common/models/timeEntry'
import { formatTime } from '@common/utils/time'
import * as HeroIcons from '@heroicons/react/24/solid'
import { MinusIcon } from '@heroicons/react/24/solid'
import { ClipboardClock } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import WebhookAuditButton from '../webhook/WebhookAuditButton'

type TimeEntryRowProps = BaseRowProps<TimeEntry> & {
  required?: boolean
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
  status,
}: Readonly<{ position: TimeEntryRowProps['position']; status: MatchStatus }>) {
  return (
    <div
      className={twMerge(
        'flex w-6 flex-none items-center justify-center rounded-sm font-kh-interface uppercase'
      )}
      aria-label={position ? `#${position}` : loc.no.timeEntry.dnf}>
      {position && <span className='text-primary'>{position}</span>}
      {status === 'planned' && (
        <ClipboardClock className='size-5 text-muted-foreground' />
      )}
      {!position && status !== 'planned' && (
        <MinusIcon className='text-muted-foreground' />
      )}
    </div>
  )
}

export function NameCellPart({
  name,
  className,
  ...props
}: Readonly<
  {
    name: string
  } & ComponentProps<'div'>
>) {
  return (
    <div
      className={twMerge('font-f1-bold truncate uppercase', className)}
      {...props}>
      {name}
    </div>
  )
}

export function Marker({
  show,
  symbol,
  Icon,
  className,
  ...props
}: Readonly<
  {
    show: boolean | undefined | null
  } & (
    | {
        symbol: string
        Icon?: undefined
      }
    | {
        symbol?: undefined
        Icon: (typeof HeroIcons)[keyof typeof HeroIcons]
      }
  ) &
    ComponentProps<'span'>
>) {
  if (!show) return null
  return (
    <span
      className={twMerge(
        'font-f1-bold truncate text-primary uppercase',
        className
      )}
      {...props}>
      {Icon !== undefined && <Icon className='size-4' />}
      {symbol !== undefined && symbol}
    </span>
  )
}

function TimePart({
  duration,
  status,
}: Readonly<{ duration?: number | null; status: TimeEntry['status'] }>) {
  if (status !== 'completed')
    return (
      <span className='text-muted-foreground'>
        {loc.no.common.status[status]}
      </span>
    )
  const isDNF = !duration
  const label = duration ? formatTime(duration) : loc.no.timeEntry.dnf
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
    gap.position === 1 ? gapType.toUpperCase() : '+' + formatTime(duration ?? 0)

  return (
    <div
      className={
        'font-f1-italic flex items-center justify-end truncate text-sm text-muted-foreground uppercase tabular-nums'
      }>
      {label}
    </div>
  )
}

export default function TimeEntryRow({
  className,
  item: lapTime,
  required,
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

  const isDNF = lapTime.status === 'completed' && !lapTime.duration

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
        'flex cursor-pointer items-center gap-4 rounded-md hover:bg-foreground/5',
        highlight && 'bg-foreground/3',
        (isDNF || lapTime.status === 'cancelled') && 'opacity-50',
        className
      )}
      title={lapTime.comment ?? undefined}
      {...rest}>
      {show.pos && (
        <PositionBadgePart position={gap?.position} status={lapTime.status} />
      )}

      <NameCellPart
        name={
          userInfo?.shortName ??
          userInfo?.lastName ??
          userInfo?.firstName ??
          loc.no.match.unknownUser
        }
        className={twMerge(isDNF && 'text-muted-foreground')}
      />
      <Marker
        className='-mx-2 text-yellow-500'
        show={lapTime.tieBreaker}
        symbol='*'
      />
      <Marker className='-mx-2' show={!!lapTime.comment} symbol='*' />

      <span className='mr-auto' />

      <Marker show={required} symbol='!' />

      {show.gap && gap && (
        <GapPart
          gap={gap}
          gapType={gapType}
          onChangeGapType={onChangeGapType}
        />
      )}
      <WebhookAuditButton
        gameId={lapTime.webhookCapture}
        participants={[lapTime.user]}
      />
      {show.time && (
        <TimePart duration={lapTime.duration} status={lapTime.status} />
      )}
    </div>
  )
}
