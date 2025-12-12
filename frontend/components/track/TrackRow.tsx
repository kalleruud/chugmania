import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import type { Track } from '@common/models/track'
import { formatTrackName } from '@common/utils/track'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import TrackBadge from './TrackBadge'

export function TrackRow({
  item: track,
  className,
  hideLink,
  highlight,
}: Readonly<BaseRowProps<Track>>) {
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
      <Item
        key={track.id}
        className={twMerge(
          highlight &&
            'bg-primary-background hover:bg-primary/25 ring-primary/50 ring-1',
          className
        )}
        asChild>
        <div>{content}</div>
      </Item>
    )
  }

  return (
    <Item
      key={track.id}
      className={twMerge(
        highlight &&
          'bg-primary-background hover:bg-primary/25 ring-primary/50 ring-1',
        className
      )}
      asChild>
      <Link to={`/tracks/${track.id}`}>{content}</Link>
    </Item>
  )
}
