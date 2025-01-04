<script lang="ts">
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<HeaderBar class="px-4 py-2">
  <h1>Baner</h1>
</HeaderBar>

<main class="mt-16 flex flex-col p-4">
  <p class="text-muted-foreground">Kommer snart...</p>
</main>
