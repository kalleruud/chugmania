import { PageHeader } from '@/components/PageHeader'
import LoginCard from '@/components/user/LoginCard'
import UserCard from '@/components/user/UserCard'
import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import { MatchesContent } from './MatchesPage'
import { SessionsContent } from './SessionsPage'
import { TracksContent } from './TracksPage'
import { UsersContent } from './UsersPage'

export default function Home() {
  const { loggedInUser, isLoggedIn } = useAuth()

  return (
    <div className='flex flex-col gap-8'>
      <h1 className='text-primary'>Chugmania</h1>
      {isLoggedIn && loggedInUser && <UserCard user={loggedInUser} />}

      <LoginCard />

      {loggedInUser?.role === 'admin' && (
        <PageHeader
          className='mx-2 my-0'
          title={loc.no.admin.title}
          icon='ShieldExclamationIcon'
          to='/admin'
        />
      )}
      <MatchesContent
        className='bg-background rounded-sm border p-2'
        showLink
      />
      <SessionsContent
        className='bg-background rounded-sm border p-2'
        showLink
      />
      <TracksContent className='bg-background rounded-sm border p-2' showLink />
      <UsersContent className='bg-background rounded-sm border p-2' showLink />
    </div>
  )
}
