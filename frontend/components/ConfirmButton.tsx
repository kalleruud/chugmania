import loc from '@/lib/locales'
import type { VariantProps } from 'class-variance-authority'
import { forwardRef, useEffect, useRef, useState } from 'react'
import { Button, buttonVariants } from './ui/button'

interface ConfirmButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  onConfirm: () => void | Promise<void>
  confirmText?: string
  confirmDuration?: number
}

export const ConfirmButton = forwardRef<HTMLButtonElement, ConfirmButtonProps>(
  (
    {
      onConfirm,
      confirmText = loc.no.common.confirm,
      confirmDuration = 3000,
      children,
      variant,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const [isConfirming, setIsConfirming] = useState(false)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    }, [])

    // Reset confirmation state after duration
    useEffect(() => {
      if (!isConfirming) return

      timeoutRef.current = setTimeout(() => {
        setIsConfirming(false)
      }, confirmDuration)

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    }, [isConfirming, confirmDuration])

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isConfirming) {
        // Second click: execute confirm action
        await onConfirm()
        setIsConfirming(false)
      } else {
        // First click: enter confirmation state
        setIsConfirming(true)
      }

      onClick?.(e)
    }

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' && isConfirming) {
        e.preventDefault()
        await onConfirm()
        setIsConfirming(false)
      } else if (e.key === 'Escape' && isConfirming) {
        e.preventDefault()
        setIsConfirming(false)
      }
    }

    return (
      <Button
        ref={ref}
        variant={isConfirming ? 'default' : variant}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...props}>
        {isConfirming ? confirmText : children}
      </Button>
    )
  }
)

ConfirmButton.displayName = 'ConfirmButton'
