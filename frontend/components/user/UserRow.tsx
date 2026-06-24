import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { type UserInfo } from '@common/models/user'
import { Award, ChevronRight, Map, Minus, Trophy } from 'lucide-react'
import { Link } from 'react-router'
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
          <div className='h-4 w-1 rounded-full bg-primary' />

          <ItemTitle className='mr-auto flex gap-1 font-f1 uppercase'>
            <span>{user.firstName}</span>
            <span className='font-bold'>{user.lastName}</span>
          </ItemTitle>

          {isAdmin && ranking && (
            <div className='hidden w-48 items-center gap-2 tabular-nums sm:flex'>
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

              <div className='flex items-center gap-1'>
                <Award className='size-4' />
                <span className='truncate text-sm'>
                  {ranking?.totalRating.toFixed()}
                </span>
              </div>
            </div>
          )}

          {ranking ? (
            <div
              className={twMerge(
                'flex items-center justify-end gap-0.5 font-kh-interface text-muted-foreground tabular-nums',
                ranking.ranking === 1 && 'text-yellow-400',
                ranking.ranking === 2 && 'text-gray-300',
                ranking.ranking === 3 && 'text-amber-600'
              )}>
              <span className='w-2 text-end'>#</span>
              <span className='w-4 font-black'>{ranking.ranking}</span>
            </div>
          ) : (
            <Minus className='size-4 text-muted-foreground' />
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
            'bg-primary-background ring-1 ring-primary/50 hover:bg-primary/25',
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
          'bg-primary-background ring-1 ring-primary/50 hover:bg-primary/25',
        className
      )}
      asChild
      {...props}>
      <Link to={`/users/${user.id}`}>{content}</Link>
    </Item>
  )
}
