import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { Link } from 'react-router-dom'
import type { Track } from '../../../common/models/track'
import { formatTrackName } from '../../../common/utils/track'
import { ChevronRight } from 'lucide-react'

type TrackItemProps = {
  track: Track
  variant: 'row' | 'card'
}

export function TrackItem(props: Readonly<TrackItemProps>) {
  switch (props.variant) {
    case 'row':
      return <TrackRow {...props} />
    case 'card':
      return <TrackCard {...props} />
  }
}

function TrackRow({ track }: Readonly<TrackItemProps>) {
  return (
    <Item key={track.id} className='w-full' asChild>
      <Link to={`/tracks/${track.id}`}>
        <ItemContent>
          <ItemTitle>
            <h2 className='font-kh-interface'>
              {formatTrackName(track.number)}
            </h2>
          </ItemTitle>
        </ItemContent>
          <ItemDescription>{`${track.level} • ${track.type}`}</ItemDescription>
        <ItemActions>
          <ChevronRight className='size-4' />
        </ItemActions>
      </Link>
    </Item>
  )
}

function TrackCard({ track }: Readonly<TrackItemProps>) {
  return (
    <Item key={track.id} variant='muted' className='w-full'>
      <ItemContent>
        <ItemTitle>{track.number}</ItemTitle>
      </ItemContent>
    </Item>
  )
}
