<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Popover from '$lib/components/ui/popover/index.js'
  import { cn } from '@/utils'
  import { ChevronsUpDown } from 'lucide-svelte'
  import Search from 'lucide-svelte/icons/search'
  import { tick } from 'svelte'
  import { type LookupEntity, type PublicUser, type Session, type Track } from './lookup.server'
  import TrackListItem from './track-list-item.svelte'
  import UserListItem from './user-list-item.svelte'
  import SessionListItem from './session-list-item.svelte'

  type Props = {
    placeholder: string
    emptyLabel?: string
    entity: 'track' | 'session' | 'user'
    items: LookupEntity[]
    selected?: LookupEntity
    class?: string
    name?: string
  }

  let {
    entity,
    placeholder,
    emptyLabel: noneSelectedLabel,
    items,
    selected = $bindable(),
    class: className,
    name: name,
  }: Props = $props()

  let open = $state(false)
  let search = $state('')
  let results = $derived(() =>
    items
      .filter(i => i.label?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (a.date && b.date) {
          return a.date.getTime() - b.date.getTime()
        }
        const indexA = a.label.toLowerCase().indexOf(search.toLowerCase())
        const indexB = b.label.toLowerCase().indexOf(search.toLowerCase())
        return indexA - indexB
      })
  )

  function onSelect(item: LookupEntity, triggerId: string) {
    console.log('onSelect', item.label)

    open = false
    selected = items.find(i => i.id === item.id)
    console.log('selected', selected)

    // We want to refocus the trigger button when the user selects
    // an item from the list so users can continue navigating the
    // rest of the form with the keyboard.
    tick().then(() => {
      document.getElementById(triggerId)?.focus()
    })
  }
</script>

<div class={cn('w-full', className)}>
  <Popover.Root bind:open let:ids>
    <Popover.Trigger asChild let:builder>
      <Button builders={[builder]} variant="outline" class="w-full justify-start">
        <ChevronsUpDown class="mr-2 size-4 shrink-0 opacity-60" />
        {#if selected}
          <input type="hidden" {name} value={selected.id} />
          {#if entity === 'track'}
            <TrackListItem item={selected as unknown as Track} />
          {/if}
          {#if entity === 'user'}
            <UserListItem item={selected as unknown as PublicUser} />
          {/if}
          {#if entity === 'session'}
            <SessionListItem item={selected as unknown as Session} />
          {/if}
        {:else}
          <div class="text-muted-foreground">{placeholder}</div>
        {/if}
      </Button>
    </Popover.Trigger>
    <Popover.Content class="w-full max-w-sm p-0" align="center">
      <div class="flex items-center border-b px-2">
        <Search class="mr-2 size-4 shrink-0 opacity-60" />
        <input
          type="text"
          class="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Søk..."
          min={0}
          max={200}
          maxlength={3}
          inputmode="numeric"
          bind:value={search}
        />
      </div>
      {#if results().length === 0}
        <div class="py-6 text-center text-sm">{noneSelectedLabel ?? 'Ingen funnet'}</div>
      {:else}
        <ul class="max-h-64 overflow-y-auto overflow-x-hidden">
          <ul class="overflow-hidden p-1 text-foreground">
            {#each results() as item}
              <button
                class="relative flex w-full select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                onclick={() => onSelect(item, ids.trigger)}
              >
                {#if entity === 'track'}
                  <TrackListItem item={item as unknown as Track} />
                {/if}
                {#if entity === 'user'}
                  <UserListItem item={item as unknown as PublicUser} />
                {/if}
                {#if entity === 'session'}
                  <SessionListItem item={item as unknown as Session} />
                {/if}
              </button>
            {/each}
          </ul>
        </ul>
      {/if}
    </Popover.Content>
  </Popover.Root>
</div>
