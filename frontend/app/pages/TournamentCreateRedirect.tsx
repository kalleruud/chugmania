import { Navigate, useParams } from 'react-router'

export default function TournamentCreateRedirect() {
  const { id } = useParams()
  return <Navigate to={`/sessions/${id}?tab=tournament`} replace />
}
