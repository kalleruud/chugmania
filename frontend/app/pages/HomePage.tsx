import { SessionsList } from '@/components/session/SessionsList'
import { Button } from '@/components/ui/button'
import LoginCard from '@/components/user/LoginCard'
import UserItem from '@/components/user/UserItem'
import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import { Link } from 'react-router-dom'
import { TracksList } from './TracksPage'
import { UsersList } from './UsersPage'

export default function Home() {
  const { loggedInUser, isLoggedIn } = useAuth()

  return (
    <div className='flex flex-col gap-8'>
      <h1 className='text-primary'>Chugmania</h1>
      {isLoggedIn && loggedInUser && (
        <UserItem
          className='bg-background rounded-sm border p-4'
          variant='card'
          user={loggedInUser}
        />
      )}
      <LoginCard />

      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <h2 className='text-muted-foreground px-1 text-sm font-medium uppercase'>
            {loc.no.session.upcoming}
          </h2>
          <Button variant='link' size='sm' asChild>
            <Link to='/sessions'>Vis alle</Link>
          </Button>
        </div>
        <SessionsList
          className='bg-background rounded-sm border p-2'
          filter='upcoming'
          limit={5}
        />
        <Button
          variant='outline'
          className='w-full'
          onClick={() => window.open('/api/sessions/calendar.ics', '_blank')}>
          {loc.no.session.calendar.subscribe}
        </Button>
      </div>

      <TracksList className='bg-background rounded-sm border p-2' />
      <UsersList className='bg-background rounded-sm border p-2' />
    </div>
  )
}
