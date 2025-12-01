import { PageHeader } from '@/components/PageHeader'
import SessionsList from '@/components/session/SessionsList'
import LoginCard from '@/components/user/LoginCard'
import UserItem from '@/components/user/UserItem'
import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import { TracksList } from './TracksPage'
import { UsersList } from './UsersPage'

export default function Home() {
  const { loggedInUser, isLoggedIn } = useAuth()

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
        <SessionsList header={loc.no.session.upcoming} after={new Date()} />
      </div>

      <TracksList className='bg-background rounded-sm border p-2' />
      <UsersList className='bg-background rounded-sm border p-2' />
    </div>
  )
}
