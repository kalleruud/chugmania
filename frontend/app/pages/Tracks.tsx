import { useData } from '../../contexts/DataContext'
import LoadingView from '../components/LoadingView'
import TrackCard from '../components/TrackCard'

export default function Tracks() {
  const { leaderboards, tracks } = useData()

  if (leaderboards === undefined || tracks === undefined) return <LoadingView />

  return (
    <div className='p-safe-or-4 flex-1'>
      <div className='grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4'>
        {Object.values(tracks)
          .filter(track => track.id in leaderboards)
          .map(track => (
            <TrackCard
              key={track.id}
              track={track}
              leaderboard={leaderboards[track.id] ?? []}
            />
          ))}
      </div>
    </div>
  )
}
