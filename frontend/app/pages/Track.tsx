import { useParams } from 'react-router-dom'
import { formatTrackName } from '../../../common/utils/track'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import LeaderboardView from '../components/Leaderboard'
import LoadingView from '../components/LoadingView'
import TrackTag from '../components/TrackTag'

export default function Track() {
  const { id } = useParams()
  const { user } = useAuth()
  const { leaderboards, tracks } = useData()
  if (!id) throw new Error('No track ID provided')

  const { entries } = leaderboards?.[id] ?? { entries: [] }
  const track = tracks?.[id]

  if (leaderboards === undefined || tracks === undefined) {
    return <LoadingView label='Loading leaderboard…' />
  }

  if (!track) {
    return (
      <div className='flex h-full w-full items-center justify-center'>
        <p className='text-center text-lg text-red-500'>
          Track &quot;{id}&quot; not found.
        </p>
      </div>
    )
  }

  return (
    <div className='grid w-full items-start gap-4 sm:flex sm:justify-center sm:pt-4'>
      <header
        className='bg-background/50 sticky top-0 flex min-w-48 items-center justify-between gap-8 border-b border-white/10 p-4 backdrop-blur-2xl sm:grid sm:border-transparent sm:bg-transparent sm:backdrop-blur-none'
        style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <h1 className={track.level === 'custom' ? 'text-amber-600' : undefined}>
          {formatTrackName(track.number)}
        </h1>
        <div className='flex gap-2'>
          <TrackTag trackLevel={track.level}>{track.level}</TrackTag>
          <TrackTag trackType={track.type}>{track.type}</TrackTag>
        </div>
      </header>

      <section className='w-full px-2 sm:max-w-2xl'>
        <LeaderboardView entries={entries} highlightedUserId={user?.id} />
      </section>
    </div>
  )
}
