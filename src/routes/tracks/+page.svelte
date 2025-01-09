<script lang="ts">
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import { ChevronRight, FilterIcon, FilterXIcon } from 'lucide-svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { tracks } = $derived(data)
  let filtering = $state(true)
</script>

<HeaderBar class="flex items-center justify-between px-4 py-2">
  <h1>Baner</h1>
  <button onclick={() => (filtering = !filtering)}>
    {#if filtering}
      <FilterXIcon class="size-6" />
    {:else}
      <FilterIcon class="size-6" />
    {/if}
  </button>
</HeaderBar>

<main class="my-16 flex flex-col p-4">
  {#await tracks}
    <p class="text-muted-foreground">Loading...</p>
  {:then tracks}
    <ul class="divide-y divide-solid">
      {#each filtering ? tracks.filter(t => t.isChuggable) : tracks as track}
        <li>
          <a
            class="my-1 flex items-center justify-between rounded-md p-2 text-lg transition-colors sm:hover:bg-muted"
            href={'tracks/' + track.id}
          >
            {track.name}
            <div class="flex items-center gap-2">
              {#if track.isChuggable}
                <p class="text-sm text-muted-foreground">Chuggable</p>
              {/if}
              <ChevronRight class="size-4 text-muted-foreground" />
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/await}
</main>
