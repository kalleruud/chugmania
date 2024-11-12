<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Command from '$lib/components/ui/command/index.js'
  import * as Popover from '$lib/components/ui/popover/index.js'
  import Search from 'lucide-svelte/icons/search'
  import { tick } from 'svelte'

  type T = { id: string; name: string }
  type Props = {
    placeholder: string
    emptyLabel?: string
    items: T[]
    selected?: T
  }

  let {
    placeholder,
    emptyLabel: noneSelectedLabel,
    items,
    selected = $bindable(),
  }: Props = $props()

  let open = $state(false)
  let search = $state('')
  let results = $derived(() =>
    items
      .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const indexA = a.name.toLowerCase().indexOf(search.toLowerCase())
        const indexB = b.name.toLowerCase().indexOf(search.toLowerCase())
        return indexA - indexB
      })
  )

  function onSelect(item: T, triggerId: string) {
    console.log('onSelect', item.name)

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

<div class="flex items-center space-x-4">
  <Popover.Root bind:open let:ids>
    <Popover.Trigger asChild let:builder>
      <Button builders={[builder]} variant="outline" size="sm" class="w-[150px] justify-start">
        {#if selected}
          {selected.name}
        {:else}
          {placeholder}
        {/if}
      </Button>
    </Popover.Trigger>
    <Popover.Content class="w-[200px] p-0" side="right" align="start">
      <div class="flex items-center border-b px-2">
        <Search class="mr-2 h-4 w-4 shrink-0 opacity-60" />
        <input
          type="text"
          class="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          {placeholder}
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
                class="relative flex w-full select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onclick={() => onSelect(item, ids.trigger)}>{item.name}</button
              >
            {/each}
          </ul>
        </ul>
      {/if}
    </Popover.Content>
  </Popover.Root>
</div>
