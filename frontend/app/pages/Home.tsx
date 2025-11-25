import LoginCard from '@/components/user/LoginCard'
import UserItem from '@/components/user/UserItem'
import { useAuth } from '@/contexts/AuthContext'
import { TracksList } from './TracksPage'
import { UsersList } from './UsersPage'

export default function Home() {
  const { user, isLoggedIn } = useAuth()

  return (
    <div className='items-center-safe px-safe-or-2 py-safe-or-4 flex flex-col'>
      <div className='flex w-full max-w-2xl flex-col gap-8'>
        <h1 className='text-primary'>Chugmania</h1>
        {isLoggedIn && user && (
          <UserItem
            className='bg-background rounded-sm border p-4'
            variant='card'
            user={user}
          />
        )}
        <LoginCard />
        <TracksList className='bg-background rounded-sm border p-2' />
        <UsersList className='bg-background rounded-sm border p-2' />
      </div>
    </div>
  )
}
