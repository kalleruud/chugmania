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
    <div
      className={twMerge(
        'bg-background/90 top-safe sticky z-10 flex flex-col rounded-md p-2 py-4 backdrop-blur',
        className
      )}
      {...props}>
      <div className='flex items-center gap-2'>
        {Icon && <Icon className='text-primary size-6' />}
        <h3 className='font-f1 text-foreground pt-1 text-xl font-bold uppercase'>
          {title}
        </h3>
      </div>
      {description && (
        <p className='text-muted-foreground text-sm font-medium'>
          {description}
        </p>
      )}
    </div>
  )
}
