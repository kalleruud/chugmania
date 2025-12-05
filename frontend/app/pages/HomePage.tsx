import { PageHeader } from '@/components/PageHeader'
import SessionsList from '@/components/session/SessionsList'
import LoginCard from '@/components/user/LoginCard'
import UserItem from '@/components/user/UserItem'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { isOngoing, isUpcoming } from '../utils/date'
import { SubscribeButton } from './SessionsPage'
import { TracksList } from './TracksPage'
import { UsersList } from './UsersPage'

export default function Home() {
  const { loggedInUser, isLoggedIn } = useAuth()
  const { sessions } = useData()

  const upcomingSessions =
    sessions?.filter(s => isUpcoming(s)).slice(0, 3) ?? []

  const ongoingSessions = sessions?.filter(s => isOngoing(s)) ?? []

  return (
    <div className='flex flex-col gap-8'>
      <h1 className='text-primary'>Chugmania</h1>
      {isLoggedIn && loggedInUser && (
        <UserItem variant='card' user={loggedInUser} />
      )}

      <LoginCard />

      <div className='bg-background flex flex-col gap-2 rounded-sm border p-2'>
        <PageHeader
          title={loc.no.session.title}
          description={loc.no.session.description}
          icon='CalendarIcon'
        />
        <SubscribeButton />

        {ongoingSessions.length > 0 && (
          <SessionsList
            header={loc.no.session.status.ongoing}
            sessions={ongoingSessions}
            hideCreate
          />
        )}

        <SessionsList
          header={loc.no.session.status.upcoming}
          sessions={upcomingSessions}
        />
      </div>

      <TracksList className='bg-background rounded-sm border p-2' />
      <UsersList className='bg-background rounded-sm border p-2' />
    </div>
  )
}
