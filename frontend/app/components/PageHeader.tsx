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
        'bg-background/80 sticky top-0 z-10 flex flex-col rounded-md p-2 pt-4 backdrop-blur-xl',
        className
      )}
      {...props}>
      <div className='flex items-center gap-2'>
        <Icon className='text-primary size-6' />
        <h3 className='font-f1 text-foreground text-xl font-bold uppercase'>
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
