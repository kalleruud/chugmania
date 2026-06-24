import { PageHeader } from '@/components/PageHeader'
import { TrackRow } from '@/components/track/TrackRow'
import { Empty } from '@/components/ui/empty'
import { Item, ItemContent, ItemMedia } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { Track } from '@common/models/track'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

export type TracksContentProps = { showLink?: true } & ComponentProps<'div'>

function TrackRowList({ tracks }: Readonly<{ tracks: Track[] }>) {
  if (tracks.length === 0) {
    return (
      <Empty className='border border-input text-sm text-muted-foreground'>
        {loc.no.common.noItems}
      </Empty>
    )
  }
  return (
    <div className='rounded-sm bg-background-secondary'>
      {tracks.map(track => (
        <TrackRow
          key={track.id}
          item={track}
          className='py-3 first:pt-4 last:pb-4'
        />
      ))}
    </div>
  )
}

export function TracksContent({
  className,
  showLink,
}: Readonly<TracksContentProps>) {
  const { tracks, timeEntries, isLoadingData } = useData()

  if (isLoadingData) {
    return (
      <div className={twMerge('flex flex-col', className)}>
        <Item>
          <ItemMedia>
            <Skeleton className='size-8 rounded-sm' />
          </ItemMedia>
          <ItemContent>
            <Skeleton className='h-6 w-24 rounded-sm' />
            <Skeleton className='h-4 w-64 rounded-sm' />
          </ItemContent>
        </Item>

        <div className='overflow-clip rounded-sm'>
          <Skeleton className='h-16 w-full divide-y divide-border rounded-none' />
          <Skeleton className='h-16 w-full divide-y divide-border rounded-none' />
          <Skeleton className='h-16 w-full divide-y divide-border rounded-none' />
        </div>
      </div>
    )
  }

  const tracksWithEntries = tracks.filter(t =>
    timeEntries.some(te => te.track === t.id)
  )

  return (
    <div className={twMerge('flex flex-col', className)}>
      <PageHeader
        title={loc.no.tracks.title}
        description={loc.no.tracks.description}
        to={showLink ? '/tracks' : undefined}
        icon={'MapIcon'}
      />

      <TrackRowList
        tracks={tracksWithEntries.filter(t => t.level !== 'custom')}
      />

      <PageHeader
        title={loc.no.tracks.level.custom}
        description={loc.no.tracks.customDescription}
        icon={'WrenchIcon'}
      />

      <TrackRowList
        tracks={tracksWithEntries.filter(t => t.level === 'custom')}
      />
    </div>
  )
}
