import * as HeroIcons from '@heroicons/react/24/solid'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

type PageHeaderProps = {
  title: string
  description?: string
  icon?: keyof typeof HeroIcons
} & ComponentProps<'div'>

export function PageHeader({
  title,
  description,
  icon,
  className,
  ...props
}: Readonly<PageHeaderProps>) {
  const Icon = icon ? HeroIcons[icon] : undefined
  return (
    <div className={twMerge('flex flex-col p-2 py-4', className)} {...props}>
      <div className='flex items-center gap-2'>
        {Icon && <Icon className='text-primary size-6' />}
        <h3 className='text-foreground pt-0.5'>{title}</h3>
      </div>
      {description && (
        <p className='text-muted-foreground text-sm font-medium'>
          {description}
        </p>
      )}
    </div>
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
        'text-muted-foreground font-f1 flex w-full justify-between p-1 pt-2 text-sm font-medium uppercase',
        className
      )}
      {...props}>
      <p>{title}</p>
      {description && <p className='opacity-50'>{description}</p>}
    </div>
  )
}
