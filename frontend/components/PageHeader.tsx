import * as HeroIcons from '@heroicons/react/24/solid'
import type { ComponentProps } from 'react'
import { Link } from 'react-router'
import { twMerge } from 'tailwind-merge'

type PageHeaderProps = {
  title: string
  description?: string | null
  Icon?: (typeof HeroIcons)[keyof typeof HeroIcons]
  to?: string
} & ComponentProps<'div'>

export function PageHeader({
  title,
  description,
  Icon,
  to,
  className,
  ...props
}: Readonly<PageHeaderProps>) {
  const content = (
    <div className='flex items-center justify-between'>
      <div className='flex flex-col' {...props}>
        <div className='flex items-center gap-2'>
          {Icon && <Icon className='size-6 text-primary' />}
          <h3 className='pt-0.5 text-foreground'>{title}</h3>
        </div>
        {description && (
          <p className='text-sm font-medium text-muted-foreground'>
            {description}
          </p>
        )}
      </div>
      {to && <HeroIcons.ChevronRightIcon className='size-4' />}
    </div>
  )

  if (to)
    return (
      <Link
        className={twMerge(
          'my-2 rounded-sm p-2 transition-colors hover:bg-primary-foreground/10',
          className
        )}
        to={to}>
        {content}
      </Link>
    )
  return (
    <div className={twMerge('my-2 rounded-sm p-2', className)}>{content}</div>
  )
}

export function PageSubheader({
  title,
  description,
  className,
  ...props
}: Readonly<Omit<PageHeaderProps, 'icon'>>) {
  return (
    <div
      className={twMerge(
        'flex w-full justify-between p-1 pt-2 font-f1 text-sm font-medium text-muted-foreground uppercase',
        className
      )}
      {...props}>
      <p>{title}</p>
      {description && <p className='opacity-50'>{description}</p>}
    </div>
  )
}
