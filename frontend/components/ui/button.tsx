import { Slot } from '@radix-ui/react-slot'
import type { VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn, variants } from '@/lib/utils'

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof variants.button> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot='button'
      className={cn(variants.button({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
