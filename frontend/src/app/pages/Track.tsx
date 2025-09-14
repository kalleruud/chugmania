import { useParams } from 'react-router-dom'
import LapTimeInput from '../components/LapTimeInput'

export default function Track() {
  const { id } = useParams()
  return (
    <div className='flex flex-col gap-4'>
      <LapTimeInput trackId={id} />
    </div>
  )
}
