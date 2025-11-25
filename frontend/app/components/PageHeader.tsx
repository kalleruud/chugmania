import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

type PageHeaderProps = {
  title: string
  description?: string
  icon: LucideIcon
} & ComponentProps<'div'>

export function PageHeader({
  title,
  description,
  icon: Icon,
  className,
  ...props
}: Readonly<PageHeaderProps>) {
  return (
    <div
      className={twMerge(
        'bg-background sticky top-0 z-10 flex flex-col gap-1 pb-4 pt-2',
        className
      )}
      {...props}>
      <div className='flex items-center gap-3'>
        <Icon className='text-primary size-8' />
        <h1 className='font-f1 text-foreground text-3xl uppercase tracking-wider'>
          {title}
        </h1>
      </div>
      {description && (
        <p className='text-muted-foreground pl-11 text-sm font-medium'>
          {description}
        </p>
      )}
    </div>
  )
}
