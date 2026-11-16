import { PageHeader } from '@/components/PageHeader'
import { Empty } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import UserRow from '@/components/user/UserRow'
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import { getChugLeaderboard } from '@common/utils/chug'
import { formatTime } from '@common/utils/time'
import { BeakerIcon } from '@heroicons/react/24/solid'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

export type ChugsContentProps = {
  limit?: number
  showLink?: boolean
} & ComponentProps<'div'>

export function ChugsContent({
  className,
  limit,
  showLink,
}: Readonly<ChugsContentProps>) {
  const { users, timeEntries, matches, isLoadingData } = useData()

  const header = (
    <PageHeader
      title={loc.no.chugs.title}
      description={loc.no.chugs.description}
      to={showLink ? '/chugs' : undefined}
      Icon={BeakerIcon}
    />
  )

  if (isLoadingData) {
    return (
      <div className={twMerge('flex flex-col', className)}>
        {header}
        <div className='overflow-clip rounded-sm'>
          <Skeleton className='h-16 w-full rounded-none' />
          <Skeleton className='h-16 w-full rounded-none' />
          <Skeleton className='h-16 w-full rounded-none' />
        </div>
      </div>
    )
  }

  const chugs = getChugLeaderboard(timeEntries, matches)
    .flatMap(chug => {
      const user = users.find(u => u.id === chug.user)
      return user ? [{ ...chug, user }] : []
    })
    .slice(0, limit)

  return (
    <div className={twMerge('flex flex-col', className)}>
      {header}
      {chugs.length === 0 ? (
        <Empty className='border border-input text-sm text-muted-foreground'>
          {loc.no.common.noItems}
        </Empty>
      ) : (
        <div className='rounded-sm bg-background-secondary'>
          {chugs.map((chug, index) => (
            <UserRow
              key={chug.user.id}
              item={chug.user}
              rank={index + 1}
              highlight={index === 0}
              className='py-3 first:pt-4 last:pb-4'>
              <span className='font-kh-interface tabular-nums'>
                {formatTime(chug.durationMs, true)}
              </span>
            </UserRow>
          ))}
        </div>
      )}
    </div>
  )
}
