import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { type UserInfo } from '@common/models/user'
import { ChevronRight, Map, Minus, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import { Spinner } from '../ui/spinner'

export default function UserRow({
  item: user,
  className,
  hideLink,
  highlight,
  ...props
}: Readonly<BaseRowProps<UserInfo>>) {
  const { loggedInUser, isLoggedIn } = useAuth()
  const { rankings, isLoadingData } = useData()

  if (isLoadingData) {
    return <Spinner className='size-4' />
  }

  const ranking = rankings.find(r => r.user === user.id)
  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'

  const content = (
    <>
      <ItemContent>
        <div className='flex items-center gap-2'>
          <div className='bg-primary h-4 w-1 rounded-full' />

          <ItemTitle className='font-f1 mr-auto flex gap-1 uppercase'>
            <span>{user.firstName}</span>
            <span className='font-bold'>{user.lastName}</span>
          </ItemTitle>

          {isAdmin && (
            <div className='flex w-32 items-center gap-2 tabular-nums'>
              <div className='flex items-center gap-1'>
                <Trophy className='size-4' />
                <span className='truncate text-sm'>
                  {ranking?.matchRating.toFixed()}
                </span>
              </div>
              <div className='flex items-center gap-1'>
                <Map className='size-4' />
                <span className='truncate text-sm'>
                  {ranking?.trackRating.toFixed()}
                </span>
              </div>
            </div>
          )}

          {ranking ? (
            <div
              className={twMerge(
                'font-kh-interface text-muted-foreground flex items-center justify-end gap-0.5 tabular-nums',
                ranking.ranking === 1 && 'text-yellow-400',
                ranking.ranking === 2 && 'text-gray-300',
                ranking.ranking === 3 && 'text-amber-600'
              )}>
              <span className='w-2 text-end'>#</span>
              <span className='w-4 font-black'>{ranking.ranking}</span>
            </div>
          ) : (
            <Minus className='text-muted-foreground size-4' />
          )}
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
      <Item
        key={user.id}
        className={twMerge(
          highlight &&
            'bg-primary-background hover:bg-primary/25 ring-primary/50 ring-1',
          className
        )}
        asChild
        {...props}>
        <div>{content}</div>
      </Item>
    )
  }

  return (
    <Item
      key={user.id}
      className={twMerge(
        highlight &&
          'bg-primary-background hover:bg-primary/25 ring-primary/50 ring-1',
        className
      )}
      asChild
      {...props}>
      <Link to={`/users/${user.id}`}>{content}</Link>
    </Item>
  )
}
