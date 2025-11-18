import LoginCard from '@/components/user/LoginCard'
import UserItem from '@/components/user/UserItem'
import { useAuth } from '@/contexts/AuthContext'
import { TracksList } from './TracksPage'

export default function Home() {
  const { user, isLoggedIn } = useAuth()

  return (
    <div className='items-center-safe px-safe-or-2 py-safe-or-8 flex flex-col'>
      <div className='flex w-full max-w-2xl flex-col gap-8'>
        <h1 className='text-primary'>Chugmania</h1>
        {isLoggedIn && user && <UserItem variant='card' user={user} />}
        <LoginCard />
        <TracksList
          isComponent
          className='border-border rounded-sm border p-2'
        />
      </div>
    </div>
  )
}
