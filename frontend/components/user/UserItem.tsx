import { useAuth } from '@/contexts/AuthContext'
import type { UserInfo } from '../../../common/models/user'
import { Button } from '../ui/button'

type UserItemProps = {
  user: UserInfo
  variant?: 'row' | 'card'
}

export default function UserItem(props: Readonly<UserItemProps>) {
  switch (props.variant) {
    case 'row':
      return <UserRow {...props} />
    case 'card':
      return <UserCard {...props} />
  }
}

function UserRow({ user }: Readonly<UserItemProps>) {
  return <div>{user.lastName}</div>
}

function UserCard({ user }: Readonly<UserItemProps>) {
  const { logout } = useAuth()
  return (
    <div className='flex items-center justify-between'>
      Hei, {user.lastName} <Button onClick={logout}>Log out</Button>
    </div>
  )
}
