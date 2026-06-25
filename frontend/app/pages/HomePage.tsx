import { PageHeader } from '@/components/PageHeader'
import UserCard from '@/components/user/UserCard'
import { useAuth } from '@/contexts/AuthContext'
import loc from '@common/locale/locales'
import { SessionsContent } from './SessionsPage'
import { TracksContent } from './TracksPage'
import { UsersContent } from './UsersPage'

export default function Home() {
  const { loggedInUser } = useAuth()

  return (
    <div className='flex flex-col gap-8'>
      <h1 className='text-primary'>Chugmania</h1>
      {loggedInUser && <UserCard user={loggedInUser} />}

      {loggedInUser?.role === 'admin' && (
        <PageHeader
          className='mx-2 my-0'
          title={loc.no.admin.title}
          icon='ShieldExclamationIcon'
          to='/admin'
        />
      )}
      <SessionsContent
        className='rounded-sm border bg-background p-2'
        showLink
      />
      <TracksContent className='rounded-sm border bg-background p-2' showLink />
      <UsersContent className='rounded-sm border bg-background p-2' showLink />
    </div>
  )
}
