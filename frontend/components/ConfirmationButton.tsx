import loc from '@common/locale/locales'
import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/button'

type ConfirmationButtonProps = Parameters<typeof Button>[0] & {
  confirmText?: string
  confirmDuration?: number
}

export default function ConfirmationButton({
  confirmText = loc.no.common.confirm,
  confirmDuration = 8000,
  form,
  onClick,
  ...props
}: Readonly<ConfirmationButtonProps>) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [width, setWidth] = useState<number>()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        style={{ ...props.style, minWidth: width }}
        variant={'default'}>
        {confirmText}
      </Button>
    )

  return (
    <Button
      {...props}
      type='button'
      onClick={e => {
        setWidth(e.currentTarget.offsetWidth)
        setIsConfirming(true)
      }}
    />
  )
}
