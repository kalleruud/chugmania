import { useParams } from 'react-router-dom'

export default function Track() {
  const { id } = useParams()
  return <div>Track {id}</div>
}
