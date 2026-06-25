import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { useData } from '@/contexts/DataContext'
import { type UserInfo } from '@common/models/user'
import { ChevronRight, Minus } from 'lucide-react'
import { Link } from 'react-router'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import { Spinner } from '../ui/spinner'

type UserRowProps = BaseRowProps<UserInfo> & {
  hideRanking?: boolean
}

export default function UserRow({
  item: user,
  className,
  hideLink,
  highlight,
  hideRanking,
  children,
  ...props
}: Readonly<UserRowProps>) {
  const { rankings, isLoadingData } = useData()

  if (isLoadingData) {
    return <Spinner className='size-4' />
  }

  const ranking = rankings.find(r => r.user === user.id)

  const content = (
    <>
      <ItemContent className='relative z-10'>
        <div className='flex items-center gap-2'>
          <div className='h-4 w-1 rounded-full bg-primary' />

          <ItemTitle className='mr-auto flex gap-1 font-f1 uppercase'>
            <span>{user.firstName}</span>
            <span className='font-bold'>{user.lastName}</span>
          </ItemTitle>

          {!hideRanking && ranking && (
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
          )}

          {!hideRanking && !ranking && (
            <Minus className='size-4 text-muted-foreground' />
          )}

          {children && (
            <div className='pointer-events-auto relative z-10'>{children}</div>
          )}
        </div>
      </ItemContent>
      {!hideLink && (
        <ItemActions className='relative z-10'>
          <ChevronRight className='size-4' />
        </ItemActions>
      )}
    </>
  )

  if (hideLink) {
    return (
      <Item
        key={user.id}
        className={twMerge(highlight && 'bg-foreground/3', className)}
        asChild
        {...props}>
        <div>{content}</div>
      </Item>
    )
  }

  return (
    <Item
      key={user.id}
      className={twMerge('relative', highlight && 'bg-foreground/3', className)}
      {...props}>
      <div className='pointer-events-none contents'>{content}</div>
      <Link
        className='absolute inset-0 z-0 rounded-sm transition-colors duration-100 hover:bg-accent/50'
        to={`/users/${user.id}`}
        aria-label={`${user.firstName} ${user.lastName}`}
      />
    </Item>
  )
}
