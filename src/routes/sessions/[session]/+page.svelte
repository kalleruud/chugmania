<script lang="ts">
  import { applyAction, deserialize, enhance } from '$app/forms'
  import { invalidateAll } from '$app/navigation'
  import Lookup from '@/components/lookup/lookup.svelte'
  import Button from '@/components/ui/button/button.svelte'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import Input from '@/components/ui/input/input.svelte'
  import Popup from '@/components/ui/popup/popup.svelte'
  import type { ActionResult } from '@sveltejs/kit'
  import {
    CheckIcon,
    PencilIcon,
    PlusIcon,
    RefreshCwIcon,
    Rotate3DIcon,
    Trash2Icon,
    XIcon,
  } from 'lucide-svelte'
  import { tick } from 'svelte'
  import type { PageData } from './$types'

  const { data }: { data: PageData } = $props()
  const { user, session, tracksWithEntries, groups, userLookup } = $derived(data)
  let isEditingTitle = $state(false)
  let titleEditRef = $state<HTMLElement>(null!)

  function onClickEdit() {
    isEditingTitle = true
    tick().then(() => titleEditRef?.focus())
  }

  function cancelEditing() {
    isEditingTitle = false
  }
</script>

<svelte:head>
  <title>{data.session.description ?? data.session.type}</title>
</svelte:head>

<HeaderBar class="grid px-4 py-2">
  <div class="flex items-center gap-2">
    {#if isEditingTitle}
      <form
        class="flex items-center gap-4"
        use:enhance={() =>
          ({ update }) => {
            cancelEditing()
            update()
          }}
        method="post"
        action="?/update"
      >
        <input type="hidden" name="id" value={session.id} />
        <Input
          bind:ref={titleEditRef}
          name="title"
          type="text"
          value={session.description}
          class="m-1 font-f1 font-black uppercase"
          style="font-size: xx-large"
          placeholder={session.type}
        />
        <button class="p-2" type="submit">
          <CheckIcon class="size-4 text-green-500" />
        </button>
        <button class="p-2" onclick={cancelEditing}>
          <XIcon class="size-4 text-muted-foreground" />
        </button>
      </form>
    {:else}
      <div class="flex items-center gap-2">
        <h1 class="uppercase">{session.description ?? session.type}</h1>
        {#if user.role === 'admin'}
          <button class="p-2" onclick={onClickEdit}>
            <PencilIcon class="size-4 text-muted-foreground" />
          </button>
        {/if}
      </div>
    {/if}
  </div>
  <p class="text-muted-foreground">{session.relativeDate}</p>
</HeaderBar>

<main class="mt-24 p-4">
  <div>
    {#each tracksWithEntries as { track, entries }}
      <div class="mb-4 flex flex-col gap-2 border-b text-sm">
        <h2 class="text-accent-foreground">{track.name}</h2>

        <ul class="divide-y divide-solid">
          {#each entries as entry, i}
            <li class="py-2">
              <div class="flex w-full justify-between font-f1">
                <div class="flex gap-2">
                  <p class="italic text-muted-foreground">{i + 1}</p>
                  <p class="font-bold">{entry.user.shortName}</p>
                </div>

                <div class="flex gap-2 tracking-wide">
                  <p class="w-20">{entry.readableDuration}</p>

                  <p class="w-20 italic text-muted-foreground">
                    {entry.readableGap}
                  </p>

                  <p class="w-20 italic text-muted-foreground">
                    {entry.readableLeaderGap}
                  </p>
                </div>
              </div>
              {#if entry.comment}
                <p class="text-muted-foreground">{entry.comment}</p>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}

    <div class="mb-4 flex flex-col gap-2 border-b text-lg">
      <ul class="divide-y divide-solid">
        {#each groups as group}
          <li class="flex w-full justify-between py-2 font-f1 font-bold">
            {group.name}
          </li>
        {/each}
      </ul>
    </div>
  </div>
  {#if user.role === 'admin'}
    <form use:enhance method="post" action="?/generateGroups">
      <Button type="submit">
        <RefreshCwIcon class="size-4" />
        Generer grupper
      </Button>
    </form>
    <Popup
      title="Sikker?"
      description="Er du sikker på at du vil slette denne sessionen?"
      triggerText="Slett"
      triggerVariant="destructive"
      buttons={[
        { title: 'Avbryt' },
        { title: 'Slett', action: '?/delete', variant: 'destructive' },
      ]}
    />
  {/if}
</main>
