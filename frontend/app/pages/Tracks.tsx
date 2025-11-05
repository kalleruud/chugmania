import { TrackItem } from '@/components/track/TrackRow'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { Map } from 'lucide-react'
import type { Track } from '../../../common/models/track'

function TrackRowList({ tracks }: Readonly<{ tracks: Track[] }>) {
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
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
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
