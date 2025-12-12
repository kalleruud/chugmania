import loc from '@/lib/locales'
import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/button'

type ConfirmationButtonProps = Parameters<typeof Button>[0] & {
  confirmText?: string
  confirmDuration?: number
}

export default function ConfirmationButton({
  confirmText = loc.no.common.confirm,
  confirmDuration = 3000,
  variant,
  type,
  form,
  onSubmit,
  onSubmitCapture,
  onClick,
  children,
  ...props
}: Readonly<ConfirmationButtonProps>) {
  const [isConfirming, setIsConfirming] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
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

  return (
    <Button
      type={isConfirming ? type : 'button'}
      form={isConfirming ? form : undefined}
      variant={isConfirming ? 'default' : variant}
      onSubmit={isConfirming ? onSubmit : undefined}
      onSubmitCapture={isConfirming ? onSubmitCapture : undefined}
      onClick={isConfirming ? onClick : () => setIsConfirming(true)}
      {...props}>
      {isConfirming ? confirmText : children}
    </Button>
  )
}
