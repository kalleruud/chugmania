import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { type UserInfo } from '@common/models/user'
import { ChevronRight } from 'lucide-react'
import { type ComponentProps } from 'react'
import { Link } from 'react-router-dom'

type UserRowProps = {
  user: UserInfo
  hideLink?: boolean
  highlighted?: boolean
} & ComponentProps<'div'>

export default function UserRow({
  user,
  className,
  hideLink,
  highlighted,
  ...props
}: Readonly<UserRowProps>) {
  const content = (
    <>
      <ItemContent>
        <div className='flex items-center gap-2'>
          <div className='bg-primary h-4 w-1 rounded-full' />
          <ItemTitle className='font-f1 mr-auto flex gap-1 uppercase'>
            <span>{user.firstName}</span>
            <span className='font-bold'>{user.lastName}</span>
          </ItemTitle>

          <span className='text-f1 text-muted-foreground font-bold'>
            {user.shortName}
          </span>
        </div>
      </ItemContent>
      {!hideLink && (
        <ItemActions>
          <ChevronRight className='size-4' />
        </ItemActions>
      )}
    </>
  )

  if (hideLink) {
    return (
      <Item key={user.id} className={className} asChild {...props}>
        <div>{content}</div>
      </Item>
    )
  }

  return (
    <Item key={user.id} className={className} asChild {...props}>
      <Link to={`/users/${user.id}`}>{content}</Link>
    </Item>
  )
}
