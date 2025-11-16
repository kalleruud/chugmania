import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { ChevronRight } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type { Track } from '../../../common/models/track'
import { formatTrackName } from '../../../common/utils/track'
import { Badge } from '../ui/badge'

type TrackItemProps = {
  track: Track
  variant: 'row' | 'card'
  className?: string
  isLink?: boolean
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
      <a href={`tracks/${track.id}`}>
        <ItemContent>
          <ItemTitle className='font-kh-interface text-2xl'>
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
      </a>
    </Item>
  )
}

function TrackCard({ track, className }: Readonly<TrackItemProps>) {
  return (
    <div key={track.id} className={twMerge('flex p-4', className)}>
      <div className='font-kh-interface flex gap-2 text-6xl font-black'>
        <p className='text-primary'>#</p>
        {formatTrackName(track.number)}
      </div>

      <div className='flex flex-1 items-end justify-end gap-1'>
        <Badge variant='outline' className='text-muted-foreground'>
          {track.level}
        </Badge>
        <Badge variant='outline' className='text-muted-foreground'>
          {track.type}
        </Badge>
      </div>
    </div>
  )
}
