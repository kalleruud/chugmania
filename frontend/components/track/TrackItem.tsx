import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import type { Track } from '@common/models/track'
import { formatTrackName } from '@common/utils/track'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import TrackBadge from './TrackBadge'

type TrackItemProps = {
  track: Track
  variant: 'row' | 'card'
  className?: string
  hideLink?: boolean
}

export function TrackItem(props: Readonly<TrackItemProps>) {
  switch (props.variant) {
    case 'row':
      return <TrackRow {...props} />
    case 'card':
      return <TrackCard {...props} />
  }
}

function TrackRow({ track, className, hideLink }: Readonly<TrackItemProps>) {
  const content = (
    <>
      <ItemContent>
        <ItemTitle className='font-kh-interface text-2xl tabular-nums tracking-tight'>
          <p className='text-primary'>#</p>
          {formatTrackName(track.number)}
        </ItemTitle>
      </ItemContent>
      <div className='flex gap-2'>
        <TrackBadge variant='outline' trackLevel={track.level}>
          {track.level}
        </TrackBadge>
        <TrackBadge variant='outline' trackType={track.type}>
          {track.type}
        </TrackBadge>
      </div>
      {!hideLink && (
        <ItemActions>
          <ChevronRight className='size-4' />
        </ItemActions>
      )}
    </>
  )

  if (hideLink) {
    return (
      <Item key={track.id} className={className} asChild>
        <div>{content}</div>
      </Item>
    )
  }

  return (
    <Item key={track.id} className={className} asChild>
      <Link to={`/tracks/${track.id}`}>{content}</Link>
    </Item>
  )
}

function TrackCard({ track, className }: Readonly<TrackItemProps>) {
  return (
    <div key={track.id} className={twMerge('flex p-4', className)}>
      <div className='font-kh-interface flex gap-2 text-6xl font-black tabular-nums tracking-tighter'>
        <p className='text-primary'>#</p>
        {formatTrackName(track.number)}
      </div>

      <div className='flex flex-1 items-end justify-end gap-1'>
        <TrackBadge variant='outline' trackLevel={track.level}>
          {track.level}
        </TrackBadge>
        <TrackBadge variant='outline' trackType={track.type}>
          {track.type}
        </TrackBadge>
      </div>
    </div>
  )
}
