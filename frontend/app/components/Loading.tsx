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
      className={twMerge('flex items-center justify-center pt-48', className)}
      {...rest}
    >
      <Spinner size={48} className='text-accent' />
      {label && <p>{label}</p>}
    </div>
  )
}
