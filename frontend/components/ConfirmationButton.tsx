import loc from '@/lib/locales'
import { useRef, useState } from 'react'
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  function startConfirming() {
    setIsConfirming(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsConfirming(false)
    }, confirmDuration)
  }

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
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }}
        variant={'default'}>
        {confirmText}
      </Button>
    )

  const initProps = { ...props }
  delete initProps.type
  delete initProps.formAction
  delete initProps.onSubmit
  delete initProps.onSubmitCapture
  return <Button {...initProps} onClick={startConfirming} />
}
