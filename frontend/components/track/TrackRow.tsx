import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import type { Track } from '@common/models/track'
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
}: Readonly<BaseRowProps<Track | null | undefined>>) {
  const content = (
    <>
      <ItemContent className='min-w-0 gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <ItemTitle className='max-w-full items-start font-kh-interface text-2xl tracking-tight tabular-nums'>
          <span
            className={twMerge(
              'shrink-0 text-primary',
              !track && 'text-muted-foreground'
            )}>
            #
          </span>
          {track ? (
            <span className='min-w-0 [overflow-wrap:anywhere]'>
              {track.name}
            </span>
          ) : (
            <span className='text-muted-foreground/50'>000</span>
          )}
        </ItemTitle>
        {track && (
          <div className='flex max-w-full min-w-0 flex-wrap gap-1.5 sm:max-w-1/2 sm:justify-end'>
            <TrackBadge variant='outline' trackLevel={track.level} />
            <TrackBadge variant='outline' trackType={track.type} />
          </div>
        )}
      </ItemContent>
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
