import MatchRow from '@/components/match/MatchRow'
import TrackLeaderboard from '@/components/track/TrackLeaderboard'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Spinner } from '@/components/ui/spinner'
import UserCard from '@/components/user/UserCard'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { getUserFullName } from '@common/models/user'
import { useParams } from 'react-router-dom'

export default function UserPage() {
  const { id } = useParams()
  const { users, tracks, isLoadingData } = useData()

  if (isLoadingData) {
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
      </div>
    )
  }

  const user = users.find(u => u.id === id)
  if (!user) throw new Error(loc.no.error.messages.not_in_db('users/' + id))

  const fullName = getUserFullName(user)

  return (
    <div className='flex flex-col gap-12'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink to='/users'>{loc.no.users.title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{fullName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <UserCard user={user} />

      <div className='flex flex-col gap-2'>
        <h2 className='text-lg font-bold'>{loc.no.match.matches}</h2>
        <div className='flex flex-col gap-2'>
          {useData()
            .matches?.filter(m => m.user1 === user.id || m.user2 === user.id)
            .map(match => (
              <MatchRow key={match.id} item={match} />
            ))}
        </div>
      </div>

      {tracks.map(track => (
        <TrackLeaderboard
          key={track.id}
          track={track}
          user={user.id}
          filter='all'
        />
      ))}
    </div>
  )
}
