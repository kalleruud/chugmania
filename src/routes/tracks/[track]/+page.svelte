<script lang="ts">
  import { enhance } from '$app/forms'
  import Button from '@/components/ui/button/button.svelte'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import type { PageData } from './$types'

  const { data }: { data: PageData } = $props()
  const { track, user } = $derived(data)
</script>

<HeaderBar class="flex items-center justify-between px-4 py-2">
  <h1>{track.name}</h1>
  {track.type}
  {track.level}
  {#if user.role === 'admin'}
    <form use:enhance method="post" action="?/toggleChuggable">
      <Button type="submit" variant="secondary">Toggle Chuggable</Button>
    </form>
  {/if}
</HeaderBar>

<main class="my-24 flex flex-col p-4">
  Is chuggable: {track.isChuggable}
</main>
