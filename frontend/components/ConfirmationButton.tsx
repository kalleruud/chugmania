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
  form,
  onClick,
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

  if (isConfirming)
    return (
      <Button
        {...props}
        onClick={e => {
          if (form)
            (
              document.getElementById(form) as HTMLFormElement | undefined
            )?.requestSubmit()
          onClick?.(e)
          setIsConfirming(false)
        }}
        variant={'default'}>
        {confirmText}
      </Button>
    )

  const { type, formAction, onSubmit, onSubmitCapture, ...initProps } = props
  return <Button {...initProps} onClick={() => setIsConfirming(true)} />
}
