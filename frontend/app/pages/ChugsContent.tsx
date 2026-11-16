import { PageHeader } from '@/components/PageHeader'
import {
  GapPart,
  NameCellPart,
  PositionBadgePart,
  TimePart,
} from '@/components/timeentries/TimeEntryRow'
import { Empty } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { ChugMode, ChugTime } from '@common/models/chugTime'
import type { GapType, LeaderboardEntryGap } from '@common/models/timeEntry'
import { Beer } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { Link } from 'react-router'
import { twMerge } from 'tailwind-merge'

export type ChugsContentProps = {
  limit?: number
  showLink?: boolean
} & ComponentProps<'div'>

function getChugGap(chugs: ChugTime[], index: number): LeaderboardEntryGap {
  const durationMs = chugs[index].durationMs
  return {
    position: index + 1,
    leader: durationMs - chugs[0].durationMs,
    previous: index > 0 ? durationMs - chugs[index - 1].durationMs : undefined,
  }
}

export function ChugsContent({
  className,
  limit,
  showLink,
}: Readonly<ChugsContentProps>) {
  const { users, chugTimes, isLoadingData } = useData()
  const { loggedInUser } = useAuth()
  const [gapType, setGapType] = useState<GapType>('interval')
  const [mode, setMode] = useState<ChugMode>('average')

  const header = (
    <PageHeader
      title={loc.no.chugs.title}
      description={loc.no.chugs.description}
      to={showLink ? '/chugs' : undefined}
      Icon={Beer}
    />
  )

  if (isLoadingData) {
    return (
      <div className={twMerge('flex flex-col', className)}>
        {header}
        <div className='overflow-clip rounded-sm'>
          <Skeleton className='h-12 w-full rounded-none' />
          <Skeleton className='h-12 w-full rounded-none' />
          <Skeleton className='h-12 w-full rounded-none' />
        </div>
      </div>
    )
  }

  const chugs = chugTimes[mode]
    .filter(chug => users.some(u => u.id === chug.user))
    .slice(0, limit)

  return (
    <div className={twMerge('flex flex-col gap-2', className)}>
      {header}
      <div className='flex w-full justify-between'>
        <ToggleGroup
          type='single'
          value={mode}
          onValueChange={value => {
            if (value === 'average' || value === 'best') setMode(value)
          }}
          variant='outline'
          size='sm'>
          <ToggleGroupItem value='average'>
            {loc.no.chugs.mode.average}
          </ToggleGroupItem>
          <ToggleGroupItem value='best'>
            {loc.no.chugs.mode.best}
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup
          type='single'
          value={gapType}
          onValueChange={value => {
            if (value === 'leader' || value === 'interval') setGapType(value)
          }}
          variant='outline'
          size='sm'>
          <ToggleGroupItem value='leader' aria-label='Gap to leader'>
            {loc.no.timeEntry.gap.leader}
          </ToggleGroupItem>
          <ToggleGroupItem value='interval' aria-label='Gap to previous'>
            {loc.no.timeEntry.gap.interval}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {chugs.length === 0 ? (
        <Empty className='border border-input text-sm text-muted-foreground'>
          {loc.no.common.noItems}
        </Empty>
      ) : (
        <div className='flex flex-col rounded-sm bg-background-secondary'>
          {chugs.map((chug, index) => {
            const user = users.find(u => u.id === chug.user)
            const gap = getChugGap(chugs, index)
            return (
              <Link
                key={chug.user}
                to={`/users/${chug.user}`}
                className={twMerge(
                  'flex items-center gap-4 rounded-md px-4 py-3 hover:bg-foreground/5',
                  chug.user === loggedInUser?.id && 'bg-foreground/3'
                )}>
                <PositionBadgePart position={gap.position} status='completed' />
                <NameCellPart
                  name={
                    user?.shortName ??
                    user?.lastName ??
                    user?.firstName ??
                    loc.no.match.unknownUser
                  }
                />
                <span className='mr-auto' />
                <GapPart
                  gap={gap}
                  gapType={gapType}
                  onChangeGapType={() =>
                    setGapType(gapType === 'leader' ? 'interval' : 'leader')
                  }
                />
                <TimePart duration={chug.durationMs} status='completed' />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
