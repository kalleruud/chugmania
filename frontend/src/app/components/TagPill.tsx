import type { ReactNode } from 'react'

type Variant = 'neutral' | 'level' | 'type'

type Props = {
  children?: ReactNode
  variant?: Variant
  value?: string
  selected?: boolean
  className?: string
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}

const base =
  'rounded-lg border px-2.5 py-1 text-[11px] uppercase tracking-wider transition'

const neutral =
  'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'

const levelClasses: Record<string, string> = {
  white: 'text-black bg-white border-white/80',
  green: 'text-green-300 bg-green-500/10 border-green-500/40',
  blue: 'text-sky-300 bg-sky-500/10 border-sky-500/40',
  red: 'text-red-300 bg-red-500/10 border-red-500/40',
  black: 'text-slate-200 bg-black/40 border-slate-600/60',
  custom: 'text-amber-300 bg-amber-500/10 border-amber-500/40',
}

const typeClasses: Record<string, string> = {
  drift: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/40',
  valley: 'text-lime-300 bg-lime-500/10 border-lime-500/40',
  lagoon: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/40',
  stadium: 'text-orange-300 bg-orange-500/10 border-orange-500/40',
}

export default function TagPill({
  children,
  variant = 'neutral',
  value,
  selected,
  className = '',
  onClick,
  type = 'button',
}: Readonly<Props>) {
  // Resolve the colored classes for this value (if any)
  const colored =
    (variant === 'level' && value && levelClasses[value]) ||
    (variant === 'type' && value && typeClasses[value]) ||
    neutral

  // When unselected, show neutral style, but reveal color on hover
  const hasSelected = typeof selected !== 'undefined'
  const toHover = (tokens: string) =>
    tokens
      .split(' ')
      .filter(Boolean)
      .map(t => `hover:${t}`)
      .join(' ')

  let selectedClass = ''
  if (hasSelected) {
    selectedClass = selected
      ? `${colored} hover:brightness-110`
      : `${neutral} ${toHover(colored)}`
  } else {
    selectedClass = colored
  }
  const cls = `${base} ${selectedClass} ${className}`

  if (onClick) {
    return (
      <button
        type={type}
        onClick={onClick}
        className={cls}
        aria-pressed={!!selected}
      >
        {children ?? value}
      </button>
    )
  }

  return <span className={cls}>{children ?? value}</span>
}
