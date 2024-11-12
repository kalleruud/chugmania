<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import TrackGrid from '@/components/track-grid/track-grid.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<svelte:head>
  <title>{data.session.description ?? data.session.type}</title>
</svelte:head>

<div class="flex flex-col sm:gap-4 sm:py-4">
  <main class="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
    <div class="flex justify-between">
      <h1>{data.session?.date?.toLocaleDateString()}</h1>
      <form use:enhance method="POST" action={`?/create`}>
        <Button type="submit">New</Button>
      </form>
    </div>
  </main>
</div>
