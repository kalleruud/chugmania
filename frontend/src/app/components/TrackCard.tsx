import type { TrackSummary } from '@chugmania/common/models/track.js'
import { formatTime } from '@chugmania/common/utils/time.js'
import { formatTrackName } from '@chugmania/common/utils/track.js'
import { Link } from 'react-router-dom'

export default function TrackCard({ track }: { track: TrackSummary }) {
  return (
    <Link
      to={`/tracks/${track.id}`}
      className='block rounded-lg border border-white/10 bg-white/5 p-4 hover:border-white/20 hover:bg-white/10'
    >
      <h3 className='font-f1-black text-accent mb-2 text-xl uppercase tracking-wider'>
        {formatTrackName(track.number)}
      </h3>
      <div className='mb-2 text-sm text-slate-200'>
        {track.topTimes.map((t, i) => (
          <div key={t.user.id} className='flex justify-between'>
            <span>
              {i + 1}. {t.user.name}
            </span>
            <span>{formatTime(t.duration)}</span>
          </div>
        ))}
      </div>
      <div className='flex gap-2 text-xs uppercase tracking-wider text-slate-300'>
        <span className='rounded bg-white/10 px-2 py-0.5'>{track.level}</span>
        <span className='rounded bg-white/10 px-2 py-0.5'>{track.type}</span>
        <span className='ml-auto'>{track.lapCount} laps</span>
      </div>
    </Link>
  )
}
