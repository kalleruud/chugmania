import { TrackItem } from '@/components/track/TrackRow'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { ChevronRight, Map } from 'lucide-react'
import { Link } from 'react-router-dom'

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
    <div className='flex w-full flex-col items-center justify-center'>
      <Item className='w-full' asChild>
        <Link to={`/tracks`}>
          <ItemMedia variant='icon'>
            <Map />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{loc.no.tracks.title}</ItemTitle>
            <ItemDescription>{loc.no.tracks.description}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <ChevronRight className='size-4' />
          </ItemActions>
        </Link>
      </Item>

      <div className='flex w-full flex-col'>
        {tracks.map(track => (
          <TrackItem key={track.id} track={track} variant='row' />
        ))}
      </div>
    </div>
  )
}
