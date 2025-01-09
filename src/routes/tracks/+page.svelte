<script lang="ts">
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { tracks } = $derived(data)
</script>

<HeaderBar class="px-4 py-2">
  <h1>Baner</h1>
</HeaderBar>

<main class="my-16 flex flex-col p-4">
  {#await tracks}
    <p class="text-muted-foreground">Loading...</p>
  {:then tracks}
    <ul class="divide-y divide-solid">
      {#each tracks as track}
        <li class="py-2">
          <a href={'tracks/' + track.id}>
            {track.name}
          </a>
        </li>
      {/each}
    </ul>
  {/await}
</main>
