import { TrackItem } from '@/components/track/TrackItem'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Empty } from '@/components/ui/empty'
import { Item, ItemContent, ItemMedia } from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { DetailedHTMLProps, HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import type { Track } from '../../../common/models/track'
import { PageHeader } from '../../components/PageHeader'

type TracksPageProps = DetailedHTMLProps<
  HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
>

function TrackRowList({ tracks }: Readonly<{ tracks: Track[] }>) {
  if (tracks.length === 0) {
    return (
      <Empty className='border-input text-muted-foreground border text-sm'>
        {loc.no.noItems}
      </Empty>
    )
  }
  return (
    <div className='bg-background-secondary rounded-sm'>
      {tracks.map(track => (
        <TrackItem
          key={track.id}
          track={track}
          variant='row'
          className='py-3 first:pt-4 last:pb-4'
        />
      ))}
    </div>
  )
}

export default function TracksPage(props: Readonly<TracksPageProps>) {
  return (
    <div className='p-safe-or-2'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{loc.no.tracks.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <TracksList {...props} />
    </div>
  )
}

export function TracksList({ className }: Readonly<TracksPageProps>) {
  const { tracks: td, leaderboards: ld } = useData()

  if (td === undefined || ld === undefined) {
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
          <Skeleton className='divide-border h-16 w-full divide-y rounded-none' />
          <Skeleton className='divide-border h-16 w-full divide-y rounded-none' />
          <Skeleton className='divide-border h-16 w-full divide-y rounded-none' />
        </div>
      </div>
    )
  }

  const tracks = Object.values(td).filter(t => t.id in ld)

  return (
    <div className={twMerge('flex flex-col', className)}>
      <div>
        <PageHeader
          title={loc.no.tracks.title}
          description={loc.no.tracks.description}
          icon={'MapIcon'}
        />

        <TrackRowList tracks={tracks.filter(t => t.level !== 'custom')} />
      </div>

      <div>
        <PageHeader
          title={loc.no.tracks.level.custom}
          description={loc.no.tracks.customDescription}
          icon={'WrenchIcon'}
        />

        <TrackRowList tracks={tracks.filter(t => t.level === 'custom')} />
      </div>
    </div>
  )
}
