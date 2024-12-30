<script lang="ts">
  import { buttonVariants } from '$lib/components/ui/button/index.js'
  import * as Popover from '$lib/components/ui/popover/index.js'
  import { cn } from '@/utils'
  import { ChevronsUpDown } from 'lucide-svelte'
  import Search from 'lucide-svelte/icons/search'
  import { tick } from 'svelte'
  import type { LookupEntity } from './lookup.server'

  type Props = {
    placeholder: string
    emptyLabel?: string
    items: LookupEntity[]
    selected?: LookupEntity
    class?: string
    name?: string
  }

  let {
    placeholder,
    emptyLabel: noneSelectedLabel,
    items,
    selected = $bindable(),
    class: className,
    name: name,
  }: Props = $props()

  let triggerRef = $state<HTMLButtonElement>(null!)
  let open = $state(false)
  let search = $state('')
  let results = $derived(() =>
    items.filter(i => i.label?.toLowerCase().includes(search.toLowerCase()))
  )

  function onSelect(item: LookupEntity) {
    closeAndFocusTrigger()
    if (item.id === selected?.id) {
      selected = undefined
    } else {
      selected = items.find(i => i.id === item.id)
    }
    console.log('selected', selected)
  }

  // We want to refocus the trigger button when the user selects
  // an item from the list so users can continue navigating the
  // rest of the form with the keyboard.
  function closeAndFocusTrigger() {
    if (!open) return
    open = false
    tick().then(() => {
      triggerRef.focus()
    })
  }
</script>

<div class={cn('w-full', className)}>
  <Popover.Root bind:open>
    <Popover.Trigger
      bind:ref={triggerRef}
      class={cn(
        buttonVariants({
          variant: 'outline',
          class: 'w-full justify-start',
        }),
        !selected && 'text-muted-foreground'
      )}
    >
      <input type="hidden" {name} value={selected?.id} />
      <ChevronsUpDown />
      {selected ? selected.label : placeholder}
    </Popover.Trigger>
    <Popover.Content class="w-full max-w-sm p-0" align="center">
      <div class="flex items-center border-b px-2">
        <Search class="mr-2 size-4 shrink-0 opacity-60" />
        <input
          type="text"
          inputmode="search"
          class="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Søk..."
          max={10}
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
                class="relative flex w-full select-none items-center rounded-sm px-2 py-1.5 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:hover:bg-accent"
                onclick={() => onSelect(item)}
              >
                <li class="items -center flex w-full truncate">{item.label}</li>
              </button>
            {/each}
          </ul>
        </ul>
      {/if}
    </Popover.Content>
  </Popover.Root>
</div>
