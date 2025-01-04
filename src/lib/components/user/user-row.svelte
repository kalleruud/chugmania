<script lang="ts">
  import { ChevronRight } from 'lucide-svelte'
  import type { PublicUser } from '../types.server'

  type Props = {
    class?: string
    user: PublicUser
    index?: number
  }

  let { class: className, user, index }: Props = $props()
</script>

<div class={className}>
  <div class="flex h-10 items-center justify-between">
    <div class="flex h-full items-center gap-2">
      {#if index !== undefined}
        <p class="font-f1 italic text-muted-foreground">{index}</p>
      {/if}
      <h3>{user.name}</h3>
    </div>
    <div class="flex gap-2">
      <p class="font-f1 italic text-muted-foreground">{user.shortName}</p>
      <ChevronRight class="size-6" />
    </div>
  </div>
</div>
