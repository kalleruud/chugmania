import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { useData } from '@/contexts/DataContext'
import { getUserFullName, type UserInfo } from '@common/models/user'
import { ChevronRight, Minus } from 'lucide-react'
import { Link } from 'react-router'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import { Spinner } from '../ui/spinner'

type UserRowProps = BaseRowProps<UserInfo> & {
  hideRanking?: boolean
  rank?: number
}

export default function UserRow({
  item: user,
  className,
  hideLink,
  highlight,
  hideRanking,
  children,
  rank,
  ...props
}: Readonly<UserRowProps>) {
  const { rankings, isLoadingData } = useData()

  if (isLoadingData) {
    return <Spinner className='size-4' />
  }

  const ranking =
    rank === undefined ? rankings.find(r => r.user === user.id)?.ranking : rank

  const showRanking = !hideRanking && ranking
  const showMissingRanking = !hideRanking && !ranking

  const content = (
    <>
      <ItemContent className='relative z-10 min-w-0'>
        <div className='flex min-w-0 items-center gap-2'>
          {showRanking && (
            <p
              className={twMerge(
                'w-6 shrink-0 text-center font-kh-interface text-lg font-black text-primary tabular-nums',
                !hideLink && highlight && 'group-hover:text-primary-foreground'
              )}>
              {ranking}
            </p>
          )}

          {showMissingRanking && (
            <Minus className='size-4 shrink-0 text-muted-foreground' />
          )}

          {hideRanking && !showRanking && !showMissingRanking && (
            <div
              className={twMerge(
                'h-4 w-1 shrink-0 rounded-full bg-primary',
                !hideLink && highlight && 'group-hover:bg-primary-foreground'
              )}
            />
          )}

          <ItemTitle
            title={getUserFullName(user)}
            className='mr-auto block w-auto min-w-0 flex-1 truncate font-f1 uppercase'>
            <span>{user.firstName}</span>{' '}
            <span className='font-bold'>{user.lastName}</span>
          </ItemTitle>

          {children && (
            <div className='pointer-events-auto relative z-10 shrink-0'>
              {children}
            </div>
          )}
        </div>
      </ItemContent>
      {!hideLink && (
        <ItemActions
          className={twMerge(
            'relative z-10 shrink-0',
            highlight && 'text-primary group-hover:text-primary-foreground'
          )}>
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
          'group flex-nowrap',
          highlight && 'bg-primary-background',
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
        'group relative flex-nowrap',
        highlight && 'bg-primary-background hover:bg-primary',
        !highlight && 'hover:bg-accent/50',
        className
      )}
      {...props}>
      <div className='pointer-events-none contents'>{content}</div>
      <Link
        className='absolute inset-0 z-0 rounded-sm transition-colors duration-100'
        to={`/users/${user.id}`}
        aria-label={`${user.firstName} ${user.lastName}`}
      />
    </Item>
  )
}
