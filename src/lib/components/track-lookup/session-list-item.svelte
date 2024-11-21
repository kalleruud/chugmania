<script lang="ts">
  import { cn } from '@/utils'
  import type { Session } from './track-grid.server'

  type Props = {
    class?: string
    item: Session
  }

  let { item, class: className }: Props = $props()
</script>

<div class={cn('flex w-full items-center justify-between', className)}>
  <div>
    {item.description ?? item.date.toLocaleDateString()}
  </div>
  <span class="text-muted-foreground">{item.type.toUpperCase()}</span>
</div>
