<script lang="ts">
  import { enhance } from '$app/forms'
  import { Badge } from '$lib/components/ui/badge/index.js'
  import { Switch } from '$lib/components/ui/switch/index.js'
  import Lookup from '@/components/lookup/lookup.svelte'
  import { type LookupEntity } from '@/components/types.server'
  import Button from '@/components/ui/button/button.svelte'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import Input from '@/components/ui/input/input.svelte'
  import Popup from '@/components/ui/popup/popup.svelte'
  import { ChevronRight, FilterIcon, FilterXIcon } from 'lucide-svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { user, tracks, trackLevelColors, trackTypeColors, allTrackLevels, allTrackTypes } =
    $derived(data)
  let filtering = $state(true)

  let isAdding = $state(false)
  let selectedType = $state<LookupEntity>()
  let selectedLevel = $state<LookupEntity>()
  let selectedIsChuggable = $state(true)
</script>

<HeaderBar class="flex items-center justify-between px-4 py-2">
  <h1>Baner</h1>
  <div class="flex items-center justify-between gap-4">
    {#if user.role === 'admin'}
      <Popup bind:open={isAdding} title="Ny bane?" triggerText="Ny" triggerVariant="secondary">
        <form
          class="grid w-full gap-4"
          use:enhance
          onsubmit={() => (isAdding = false)}
          method="post"
          action="?/create"
        >
          <Input
            type="number"
            min={0}
            step={1}
            name="number"
            inputmode="numeric"
            placeholder="Nummer"
            required
          />

          <div class="flex gap-4">
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
          </div>

          <div class="flex items-center justify-between">
            <label for="is_chuggable" class="text-muted-foreground">Chuggbar?</label>
            <Switch
              name="is_chuggable"
              value={selectedIsChuggable ? 'true' : 'false'}
              bind:checked={selectedIsChuggable}
            />
          </div>
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
        <li
          class="flex items-center justify-between gap-4 text-lg transition-colors sm:hover:bg-stone-900"
        >
          <a class="w-full py-2 ps-2" href={'tracks/' + track.id}>
            <h3>{track.name}</h3>
          </a>

          <div class="flex items-center gap-2">
            <Badge class={track.level.class}>{track.level.id}</Badge>
            <Badge class={track.type.class}>{track.type.id}</Badge>
          </div>
          <div class="flex items-center gap-2">
            {#if user.role === 'admin'}
              <form class="flex gap-2" use:enhance method="post" action="?/update">
                <input type="hidden" name="id" value={track.id} />
                <Button
                  name="is_chuggable"
                  value={track.isChuggable ? 'false' : 'true'}
                  type="submit"
                  class="h-8"
                  variant={track.isChuggable ? 'default' : 'outline'}
                  size="sm"
                >
                  Chuggable
                </Button>
                <Button
                  type="submit"
                  class="h-8"
                  formaction="?/delete"
                  variant="destructive"
                  size="sm"
                >
                  Slett
                </Button>
              </form>
            {:else if track.isChuggable}
              <p class="text-sm text-muted-foreground">Chuggable</p>
            {/if}
            <ChevronRight class="size-4 text-muted-foreground" />
          </div>
        </li>
      {/each}
    </ul>
  {/await}
</main>
