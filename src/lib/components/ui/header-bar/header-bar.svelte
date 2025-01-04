<script lang="ts">
  import { cn } from '@/utils'
  import type { Snippet } from 'svelte'

  type Props = {
    class?: string
    children: Snippet
  }

  let { class: className, children }: Props = $props()
</script>

<header class="z-9 fixed top-0 w-full border-b bg-background/75 backdrop-blur pt-safe">
  <div class={className}>
    {@render children()}
  </div>
</header>
