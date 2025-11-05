import { TrackItem } from '@/components/track/TrackRow'
import { Empty } from '@/components/ui/empty'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Skeleton } from '@/components/ui/skeleton'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { Map } from 'lucide-react'
import type { Track } from '../../../common/models/track'
import { getRandomItem } from '../utils/utils'

function TrackRowList({ tracks }: Readonly<{ tracks: Track[] }>) {
  if (tracks.length === 0) {
    return (
      <Empty className='border-input text-muted-foreground border text-sm'>
        {getRandomItem(loc.no.noItems)}
      </Empty>
    )
  }
  return (
    <div className='bg-background-secondary rounded-sm'>
      {tracks.map(track => (
        <TrackItem key={track.id} track={track} variant='row' />
      ))}
    </div>
  )
}

export default function TrackPage() {
  const { tracks: td, leaderboards: ld } = useData()

  if (td === undefined || ld === undefined) {
    return (
      <div className='flex flex-col p-2'>
        <Item>
          <ItemMedia>
            <Skeleton className='size-8 rounded-sm' />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              <Skeleton className='h-6 w-24 rounded-sm' />
            </ItemTitle>
            <ItemDescription>
              <Skeleton className='h-4 w-64 rounded-sm' />
            </ItemDescription>
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
    <div className='flex flex-col p-2'>
      <Item className='w-full'>
        <ItemMedia variant='icon'>
          <Map />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            <h3>{loc.no.tracks.title}</h3>
          </ItemTitle>
          <ItemDescription>{loc.no.tracks.description}</ItemDescription>
        </ItemContent>
      </Item>

      <TrackRowList tracks={tracks.filter(t => t.level !== 'custom')} />

      <Item className='w-full pb-2'>
        <ItemContent>
          <ItemTitle>
            <h3>{loc.no.tracks.level.custom}</h3>
          </ItemTitle>
          <ItemDescription>{loc.no.tracks.description}</ItemDescription>
        </ItemContent>
      </Item>

      <TrackRowList tracks={tracks.filter(t => t.level === 'custom')} />
    </div>
  )
}
