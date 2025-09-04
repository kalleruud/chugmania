import type { TrackSummary } from '@chugmania/common/models/track.js'
import { formatTime } from '@chugmania/common/utils/time.js'
import { formatTrackName } from '@chugmania/common/utils/track.js'
import { Link } from 'react-router-dom'
import TagPill from './TagPill'

export default function TrackCard({
  track,
}: Readonly<{ track: TrackSummary }>) {
  

  const levelRail: Record<string, string> = {
    white: 'from-white to-white/70',
    green: 'from-green-400 to-green-600',
    blue: 'from-sky-400 to-sky-600',
    red: 'from-red-400 to-red-600',
    black: 'from-slate-500 to-slate-800',
    custom: 'from-amber-400 to-amber-600', // yellow-ish for custom
  }

  return (
    <Link
      to={`/tracks/${track.id}`}
      className='group relative block overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-white/20 hover:bg-white/10'
    >
      {/* Accent rail colored by level */}
      <div
        className={`absolute inset-y-0 left-0 w-2 bg-gradient-to-b opacity-70 transition group-hover:opacity-100 ${
          levelRail[track.level] ?? 'from-accent to-accent-secondary/80'
        }`}
      />

      <div className='pl-4'>
        <div className='mb-4 flex items-baseline gap-2'>
          <h3 className='font-f1-black text-accent text-2xl uppercase tracking-wider'>
            {formatTrackName(track.number)}
          </h3>
          <div className='ml-auto text-xs text-slate-300'>
            <span className='rounded-md border border-white/10 bg-white/5 px-2.5 py-1'>{
              track.lapCount
            }{' '}
              laps
            </span>
          </div>
        </div>

        <div className='mb-4 divide-y divide-white/5 rounded-lg border border-white/10 bg-black/20'>
          {track.topTimes.length === 0 ? (
            <div className='text-label-muted p-3 text-xs'>No times yet</div>
          ) : (
            track.topTimes.map((t, i) => (
              <div key={t.user.id} className='flex items-center justify-between p-3 text-base text-slate-200'>
                <span className='text-slate-300'>
                  <span className='text-slate-400'>{i + 1}.</span> {t.user.name}
                </span>
                <span className='font-f1-wide'>{formatTime(t.duration)}</span>
              </div>
            ))
          )}
        </div>

        <div className='flex items-center gap-2.5 text-slate-300'>
          <TagPill variant='level' value={track.level}>{track.level}</TagPill>
          <TagPill variant='type' value={track.type}>{track.type}</TagPill>
        </div>
      </div>
      {/* Glow on hover */}
      <div className='pointer-events-none absolute inset-0 rounded-xl opacity-0 transition group-hover:opacity-100' style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 10px 30px -10px rgba(255,255,255,0.08)' }} />
    </Link>
  )
}
