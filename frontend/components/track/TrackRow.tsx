import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import type { Track } from '@common/models/track'
import { formatTrackName } from '@common/utils/track'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import TrackBadge from './TrackBadge'

export function TrackRow({
  item: track,
  className,
  hideLink,
  highlight,
}: Readonly<BaseRowProps<Track | undefined>>) {
  const content = (
    <>
      <ItemContent>
        <ItemTitle className='font-kh-interface text-2xl tracking-tight tabular-nums'>
          <p
            className={twMerge(
              'text-primary',
              !track && 'text-muted-foreground'
            )}>
            #
          </p>
          {track ? (
            formatTrackName(track.number)
          ) : (
            <span className='text-muted-foreground/50'>000</span>
          )}
        </ItemTitle>
      </ItemContent>
      {track && (
        <div className='flex gap-2'>
          <TrackBadge variant='outline' trackLevel={track.level}>
            {track.level}
          </TrackBadge>
          <TrackBadge variant='outline' trackType={track.type}>
            {track.type}
          </TrackBadge>
        </div>
      )}
      {!hideLink && track && (
        <ItemActions>
          <ChevronRight className='size-4' />
        </ItemActions>
      )}
    </>
  )

  if (hideLink || !track) {
    return (
      <Item
        key={track?.id}
        className={twMerge(highlight && 'bg-foreground/3', className)}
        asChild>
        <div>{content}</div>
      </Item>
    )
  }

  return (
    <Item
      key={track.id}
      className={twMerge(highlight && 'bg-foreground/3', className)}
      asChild>
      <Link to={`/tracks/${track.id}`}>{content}</Link>
    </Item>
  )
}
