import type { DetailedHTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'
import Spinner from './Spinner'

type LoadingViewProps = DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> & { label?: string }

export default function LoadingView({
  label,
  className,
  ...rest
}: Readonly<LoadingViewProps>) {
  return (
    <div
      className={twMerge(
        'flex h-screen touch-none flex-col items-center justify-center gap-2',
        className
      )}
      {...rest}
    >
      <Spinner size={48} className='text-accent' />
      {label && <p className='font-f1 text-label-muted'>{label}</p>}
    </div>
  )
}
