<script lang="ts">
  import { enhance } from '$app/forms'
  import { Calendar } from '$lib/components/ui/calendar/index.js'
  import * as Popover from '$lib/components/ui/popover/index.js'
  import GroupCompact from '@/components/group/group-compact.svelte'
  import MatchRow from '@/components/match/match-row.svelte'
  import Button, { buttonVariants } from '@/components/ui/button/button.svelte'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import Input from '@/components/ui/input/input.svelte'
  import Popup from '@/components/ui/popup/popup.svelte'
  import { cn, fromDate, toRelativeLocaleDateString } from '@/utils'
  import { CalendarDate, getLocalTimeZone } from '@internationalized/date'
  import { CheckIcon, PencilIcon, RefreshCwIcon, SwordsIcon, UsersIcon, XIcon } from 'lucide-svelte'
  import CalendarIcon from 'lucide-svelte/icons/calendar'
  import { tick } from 'svelte'
  import type { PageData } from './$types'
  import { invalidateAll } from '$app/navigation'

  const { data }: { data: PageData } = $props()
  let { loggedInUser, session, tracksWithEntries, groups, matches } = $derived(data)
  let isEditing = $state(false)
  let titleEditRef = $state<HTMLElement>(null!)
  let selectedDate = $state<CalendarDate | undefined>(undefined)

  function onClickEdit() {
    isEditing = true
    selectedDate = fromDate(session.date)
    tick().then(() => titleEditRef?.focus())
  }

  function cancelEditing() {
    isEditing = false
  }
</script>

<svelte:head>
  <title>{data.session.description ?? data.session.type}</title>
</svelte:head>

<HeaderBar class="grid px-4 py-2">
  <div class="flex items-center gap-2">
    {#if isEditing}
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
        <div class="grid w-fit gap-2">
          <Input
            bind:ref={titleEditRef}
            name="title"
            type="text"
            value={session.description}
            class="font-f1 font-black uppercase"
            style="font-size: xx-large"
            placeholder={session.type}
          />

          <Popover.Root>
            <Popover.Trigger
              class={cn(
                buttonVariants({
                  variant: 'outline',
                  class: 'justify-start text-left font-normal',
                }),
                !selectedDate && 'text-muted-foreground'
              )}
            >
              <input type="hidden" name="date" value={selectedDate} />
              <CalendarIcon />
              {selectedDate
                ? toRelativeLocaleDateString(selectedDate.toDate(getLocalTimeZone()))
                : 'Velg dato...'}
            </Popover.Trigger>
            <Popover.Content class="w-auto p-0">
              <Calendar type="single" bind:value={selectedDate} initialFocus />
            </Popover.Content>
          </Popover.Root>
        </div>
        <button class="p-2" type="submit">
          <CheckIcon class="size-4 text-green-500" />
        </button>
        <button class="p-2" onclick={cancelEditing}>
          <XIcon class="size-4 text-muted-foreground" />
        </button>
      </form>
    {:else}
      <div class="flex w-full items-center justify-between">
        <div>
          <h1 class="uppercase">{session.description ?? session.type}</h1>
          <p class="text-muted-foreground">{session.relativeDate}</p>
        </div>
        {#if loggedInUser.role === 'admin'}
          <button class="p-2" onclick={onClickEdit}>
            <PencilIcon class="size-4" />
          </button>
        {/if}
      </div>
    {/if}
    <Button onclick={() => invalidateAll()}>
      <RefreshCwIcon class="size-4" />
    </Button>
  </div>
</HeaderBar>

<main class="my-24 p-4">
  {#if loggedInUser.role === 'admin'}
    <div class="flex w-full justify-center">
      <div class="mb-4 flex w-fit gap-2 rounded-lg border p-2">
        <form use:enhance method="post">
          <Button type="submit" formaction="?/generateGroups">
            <UsersIcon class="size-4" />
            <span>Generer grupper</span>
          </Button>
        </form>
        <form use:enhance method="post">
          <Button type="submit" formaction="?/scheduleMatches">
            <SwordsIcon class="size-4" />
            <span>Generer matcher</span>
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
      </div>
    </div>
  {/if}
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

    <h2>Grupper</h2>
    <div class="my-4 grid gap-4">
      {#each groups as group}
        <div class="flex flex-col gap-2 rounded-xl border bg-black p-4">
          <GroupCompact {group} user={loggedInUser} />
        </div>
      {/each}
    </div>

    <h2 class="pt-4">Matcher</h2>
    <ul class="divide-y divide-solid">
      {#each matches as match}
        <MatchRow {match} user={loggedInUser} />
      {/each}
    </ul>
  </div>
</main>
