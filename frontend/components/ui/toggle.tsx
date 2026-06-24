import * as TogglePrimitive from '@radix-ui/react-toggle'
import type { VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn, variants } from '@/lib/utils'

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof variants.toggle>) {
  return (
    <TogglePrimitive.Root
      data-slot='toggle'
      className={cn(variants.toggle({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle }
