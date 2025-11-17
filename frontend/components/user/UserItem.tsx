import type { UserInfo } from '../../../common/models/user'

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
  return <div>{user.lastName}</div>
}
