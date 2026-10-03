import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import { formatDateWithYear, formatTimeOnly } from '@common/utils/date'
import { formatTime } from '@common/utils/time'
import { twMerge } from 'tailwind-merge'
import { TrackRow } from '../track/TrackRow'
import { Badge } from '../ui/badge'
import MatchRow, { type MatchRowProps } from './MatchRow'

export default function MatchCard({
  item: match,
  className,
  hideTrack,
  ...props
}: Readonly<MatchRowProps>) {
  const { tracks, sessions } = useData()
  const track = tracks?.find(track => track.id === match.track)
  const session = sessions?.find(session => session.id === match.session)

  return (
    <MatchRow
      {...props}
      item={match}
      expanded
      hideTrack
      className={twMerge(
        className,
        'border border-primary/40 bg-primary/5 p-6 sm:p-8'
      )}>
      <div className='flex flex-col gap-4 border-t border-primary/20 pt-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <Badge>{loc.no.match.upNext}</Badge>
          <span className='text-sm text-muted-foreground'>
            {loc.no.match.status[match.status]}
          </span>
        </div>
        {track && !hideTrack && (
          <TrackRow item={track} hideLink className='p-0' />
        )}
        {session && (
          <p className='text-sm text-muted-foreground'>
            {formatDateWithYear(session.date)} · {formatTimeOnly(session.date)}
            {session.location && ` · ${session.location}`}
          </p>
        )}
        <dl className='grid gap-4 sm:grid-cols-2'>
          <div>
            <dt className='text-sm text-muted-foreground'>
              {loc.no.match.duration}
            </dt>
            <dd className='font-kh-interface text-xl tabular-nums'>
              {match.duration === null
                ? loc.no.match.placeholder.none
                : formatTime(match.duration)}
            </dd>
          </div>
          {match.comment && (
            <div>
              <dt className='text-sm text-muted-foreground'>
                {loc.no.match.form.comment}
              </dt>
              <dd className='wrap-break-word whitespace-pre-wrap'>
                {match.comment}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </MatchRow>
  )
}
