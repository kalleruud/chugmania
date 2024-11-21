<script lang="ts">
  import { cn } from '@/utils'
  import type { PublicUser } from './track-grid.server'

  type Props = {
    class?: string
    item: PublicUser
  }

  let { item, class: className }: Props = $props()
  let isAdmin = item.isAdmin ? 'Admin' : 'User'
</script>

<div class={cn('flex w-full items-center justify-between', className)}>
  <span class="font-f1 text-sm">
    {item.name.toUpperCase()}
  </span>
  <span class="text-muted-foreground">{isAdmin}</span>
</div>
