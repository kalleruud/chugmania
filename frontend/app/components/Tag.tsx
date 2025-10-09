import { type DetailedHTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

export type TagProps = DetailedHTMLProps<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> & {
  selected?: boolean
  variation?: 'default' | 'colored' | 'muted'
}

const base =
  'rounded-2xl font-f1 border border-white/10 px-2.5 py-1 text-xs tracking-wide uppercase transition'

const focused = 'bg-white/10 border-white/20'
const focusedColor = 'bg-accent/10 border-accent/50'
const muted = 'bg-background-secondary'

export default function Tag({
  className = '',
  variation = 'default',
  children,
  onClick,
  selected,
  ...rest
}: Readonly<TagProps>) {
  let cls: string = base

  switch (variation) {
    case 'colored':
      cls = twMerge(cls, focusedColor)
      break
    case 'muted':
      cls = twMerge(cls, muted)
      break
    default:
      cls = twMerge(cls, focused)
  }

  const handleClick =
    typeof onClick === 'function'
      ? (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
          onClick(e)
        }
      : undefined

  if (typeof onClick === 'function') {
    cls = twMerge(cls, 'cursor-pointer', selected ? focused : muted)
  } else cls = twMerge(cls, focused)

  return (
    <button
      className={twMerge(cls, className)}
      aria-pressed={!!selected}
      disabled={typeof onClick !== 'function'}
      onClick={handleClick}
      {...rest}>
      {children}
    </button>
  )
}
