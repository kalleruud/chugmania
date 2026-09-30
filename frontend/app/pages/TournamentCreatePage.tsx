import TournamentForm from '@/components/tournament/TournamentForm'
import { useAuth } from '@/contexts/AuthContext'
import loc from '@common/locale/locales'
import { useNavigate, useParams } from 'react-router'

export default function TournamentCreatePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { loggedInUser, isLoggedIn, isLoading } = useAuth()
  if (isLoading) return null
  if (!id || !isLoggedIn || loggedInUser.role === 'user')
    throw new Error(loc.no.error.messages.insufficient_permissions)
  return (
    <div className='flex flex-col gap-6'>
      <h1>{loc.no.tournament.create}</h1>
      <TournamentForm
        key={id}
        session={id}
        onCreated={() => navigate(`/sessions/${id}`)}
      />
    </div>
  )
}
