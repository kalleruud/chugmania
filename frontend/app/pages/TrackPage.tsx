import { Empty, EmptyHeader } from '@/components/ui/empty'
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

  if (id === undefined) {
    return (
      <Empty>
        <EmptyHeader>Fant ikke</EmptyHeader>
      </Empty>
    )
  }

  const track = tracks[id]

  return null
}
