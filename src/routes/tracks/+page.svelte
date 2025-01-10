<script lang="ts">
  import { enhance } from '$app/forms'
  import Lookup from '@/components/lookup/lookup.svelte'
  import { type LookupEntity } from '@/components/types.server'
  import Button from '@/components/ui/button/button.svelte'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import Input from '@/components/ui/input/input.svelte'
  import Popup from '@/components/ui/popup/popup.svelte'
  import { ChevronRight, FilterIcon, FilterXIcon } from 'lucide-svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { tracks, user, allTrackLevels, allTrackTypes } = $derived(data)
  let filtering = $state(true)

  let isAdding = $state(false)
  let selectedType = $state<LookupEntity>()
  let selectedLevel = $state<LookupEntity>()
</script>

<HeaderBar class="flex items-center justify-between px-4 py-2">
  <h1>Baner</h1>
  <div class="flex items-center justify-between gap-4">
    {#if user.role === 'admin'}
      <Popup bind:open={isAdding} title="Ny bane?" triggerText="Ny" triggerVariant="secondary">
        <form class="grid w-full gap-4" use:enhance method="post" action="?/create">
          <Input
            type="number"
            min={0}
            step={1}
            name="name"
            inputmode="numeric"
            placeholder="Nummer"
            required
          />
          <Lookup
            name="type"
            placeholder="Velg banetype..."
            items={allTrackTypes}
            bind:selected={selectedType}
          />

          <Lookup
            name="level"
            placeholder="Velg level..."
            items={allTrackLevels}
            bind:selected={selectedLevel}
          />
          <Button type="submit">Jæ</Button>
          <Button type="reset" variant="outline" onclick={() => (isAdding = false)}>Næ</Button>
        </form>
      </Popup>
    {/if}
    <button onclick={() => (filtering = !filtering)}>
      {#if filtering}
        <FilterXIcon class="size-6" />
      {:else}
        <FilterIcon class="size-6" />
      {/if}
    </button>
  </div>
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
