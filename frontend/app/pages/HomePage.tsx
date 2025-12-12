import LoginCard from '@/components/user/LoginCard'
import UserCard from '@/components/user/UserCard'
import { useAuth } from '@/contexts/AuthContext'
import { SessionsContent } from './SessionsPage'
import { TracksList } from './TracksPage'
import { UsersList } from './UsersPage'

export default function Home() {
  const { loggedInUser, isLoggedIn } = useAuth()

  return (
    <div className='flex flex-col gap-8'>
      <h1 className='text-primary'>Chugmania</h1>
      {isLoggedIn && loggedInUser && <UserCard user={loggedInUser} />}

      <LoginCard />

      <SessionsContent className='bg-background rounded-sm border p-2' />
      <TracksList className='bg-background rounded-sm border p-2' />
      <UsersList className='bg-background rounded-sm border p-2' />
    </div>
  )
}
