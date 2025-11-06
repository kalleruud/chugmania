import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Track } from '../../../common/models/track'
import { formatTrackName } from '../../../common/utils/track'
import { Badge } from '../ui/badge'

type TrackItemProps = {
  track: Track
  variant: 'row' | 'card'
  className?: string
}

export function TrackItem(props: Readonly<TrackItemProps>) {
  switch (props.variant) {
    case 'row':
      return <TrackRow {...props} />
    case 'card':
      return <TrackCard {...props} />
  }
}

function TrackRow({ track, className }: Readonly<TrackItemProps>) {
  return (
    <Item key={track.id} className={className} asChild>
      <Link to={`/tracks/${track.id}`}>
        <ItemContent>
          <ItemTitle className='font-kh-interface text-xl'>
            <p className='text-primary'>#</p>
            {formatTrackName(track.number)}
          </ItemTitle>
        </ItemContent>
        <div className='flex gap-1'>
          <Badge variant='outline' className='text-muted-foreground'>
            {track.level}
          </Badge>
          <Badge variant='outline' className='text-muted-foreground'>
            {track.type}
          </Badge>
        </div>
        <ItemActions>
          <ChevronRight className='size-4' />
        </ItemActions>
      </Link>
    </Item>
  )
}

function TrackCard({ track, className }: Readonly<TrackItemProps>) {
  return (
    <Item key={track.id} variant='muted' className={className}>
      <ItemContent>
        <ItemTitle>{track.number}</ItemTitle>
      </ItemContent>
    </Item>
  )
}
