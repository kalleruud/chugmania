import type { ButtonHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

type ButtonVariant = 'primary' | 'secondary' | 'tertiary'
type ButtonSize = 'sm' | 'md' | 'lg'
type ButtonState = 'default' | 'unselected' | 'selected'

export type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  state?: ButtonState
} & ButtonHTMLAttributes<HTMLButtonElement>

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'to-accent-secondary font-bold from-accent shadow-accent/60 bg-gradient-to-br shadow-[0_10px_30px_-10px_rgba(var(--color-accent),0.6)] hover:brightness-110',
  secondary:
    'border border-white/10 font-bold bg-white/5 hover:border-white/20 hover:bg-white/10',
  tertiary: 'text-label-muted hover:text-accent px-0 py-0',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-3 text-sm',
  lg: 'px-5 py-4 text-base',
}

const tertiarySizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

const stateStyles: Record<ButtonState, string> = {
  default: '',
  unselected: 'opacity-70 hover:opacity-100',
  selected: 'ring-2 ring-accent/60',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      state = 'default',
      disabled,
      className,
      children,
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled === true || rest['aria-disabled'] === 'true'

    const appliedSize =
      variant === 'tertiary' ? tertiarySizeStyles[size] : sizeStyles[size]

    return (
      <button
        ref={ref}
        className={twMerge(
          'font-f1 flex cursor-pointer items-center justify-center gap-2 rounded-xl uppercase tracking-wider transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:saturate-0',
          variantStyles[variant],
          appliedSize,
          className,
          stateStyles[state]
        )}
        disabled={isDisabled}
        {...rest}>
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
