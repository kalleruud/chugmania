import { Button } from '@/components/ui/button'
import loc from '@/lib/locales'
import { CalendarIcon } from '@heroicons/react/24/solid'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

function subscribe() {
  const url = `${globalThis.location.origin}/api/sessions/calendar.ics`.replace(
    /^https?:\/\//,
    'webcal://'
  )
  window.open(url)
}

export function SubscribeButton({
  className,
  ...rest
}: Readonly<ComponentProps<typeof Button>>) {
  return (
    <Button
      className={twMerge('flex-1', className)}
      onClick={subscribe}
      {...rest}>
      <CalendarIcon className='size-4' />
      {loc.no.session.calendar.subscribe}
    </Button>
  )
}
