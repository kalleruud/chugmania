import { Spinner } from '@/components/ui/spinner'
import { useData } from '@/contexts/DataContext'
import { useParams } from 'react-router-dom'

export default function TrackPage() {
  const { id } = useParams()
  const { tracks, leaderboards } = useData()

  if (tracks === undefined || leaderboards === undefined) {
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
      </div>
    )
  }

  if (id === undefined) throw new Error('Ingen id')
  if (id in tracks) throw new Error('Banen med denne iden finnes ikke')

  const track = tracks[id]
  const leaderboard = id in leaderboards ? leaderboards[id].entries : []

  return <h1>{track.number}</h1>
}
