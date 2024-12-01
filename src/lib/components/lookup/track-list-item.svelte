<script lang="ts">
  import { cn } from '@/utils'
  import type { Track } from './lookup.server'

  type Props = {
    class?: string
    item: Track
  }

  let { item, class: className }: Props = $props()

  const levelStyles: Record<Track['level'], string> = {
    custom: 'dark:text-orange-900 text-orange-400',
    blue: 'dark:text-blue-900 text-blue-400',
    green: 'dark:text-green-900 text-green-400',
    red: 'dark:text-red-900 text-red-400 dark:hover:text-red-800 hover:text-red-500',
    white: 'dark:text-white text-stone-900',
    black: 'dark:text-black dark:bg-white text-stone-900 text-stone-100',
  }
</script>

<div class={cn('flex w-full items-center justify-between gap-1', className)}>
  <div>
    <span class="italic text-muted-foreground">{item.name.at(0)}</span>
    {item.name.slice(1)}
  </div>
  <span class={cn('rounded-sm px-1 text-sm', levelStyles[item.level])}
    >{item.level.at(0)?.toLocaleUpperCase()}</span
  >
</div>
