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

export default function Home() {
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
          <ItemTitle>{loc.no.tracks.title}</ItemTitle>
          <ItemDescription>{loc.no.tracks.description}</ItemDescription>
        </ItemContent>
      </Item>

      <div className='bg-background-secondary divide-primary flex w-full flex-col divide-y rounded-sm'>
        {tracks
          .filter(t => t.level !== 'custom')
          .map(track => (
            <TrackItem key={track.id} track={track} variant='row' />
          ))}
      </div>

      <Item className='w-full pb-2'>
        <ItemContent>
          <ItemTitle>Custom</ItemTitle>
        </ItemContent>
      </Item>

      <div className='bg-background-secondary flex w-full flex-col rounded-sm'>
        {tracks
          .filter(t => t.level === 'custom')
          .map(track => (
            <TrackItem key={track.id} track={track} variant='row' />
          ))}
      </div>
    </div>
  )
}
