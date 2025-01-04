<script lang="ts">
  import { enhance } from '$app/forms'
  import { goto } from '$app/navigation'
  import { Calendar } from '$lib/components/ui/calendar/index.js'
  import * as Popover from '$lib/components/ui/popover/index.js'
  import type { LookupEntity } from '@/components/lookup/lookup.server'
  import Lookup from '@/components/lookup/lookup.svelte'
  import Button, { buttonVariants } from '@/components/ui/button/button.svelte'
  import Input from '@/components/ui/input/input.svelte'

  import { cn, fromDate, toRelativeLocaleDateString } from '@/utils'
  import { CalendarDate, getLocalTimeZone } from '@internationalized/date'
  import CalendarIcon from 'lucide-svelte/icons/calendar'
  import type { PageData } from './$types'

  const { data }: { data: PageData } = $props()
  const { allUsers, allTracks, mostRecentSession, mostRecentTimeEntry } = data

  let selectedUser = $state<LookupEntity | undefined>(
    allUsers.find(u => u.id === mostRecentTimeEntry?.user.id)
  )
  let selectedTrack = $state<LookupEntity | undefined>(
    allTracks.find(t => t.id === mostRecentTimeEntry?.track.id)
  )
  let selectedDate = $state<CalendarDate | undefined>(
    !mostRecentSession?.date ? undefined : fromDate(mostRecentSession.date)
  )

  let minutes = $state(undefined as number | undefined)
  let seconds = $state(undefined as number | undefined)

  let formIsValid = $derived(selectedTrack && selectedUser && selectedDate && (minutes || seconds))

  const numberInputClass =
    'flex w-20 rounded-md border bg-transparent text-center outline-none placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

  $effect(() => {
    let params = new URLSearchParams()
    if (selectedTrack) params.set('track', selectedTrack.label)
    if (selectedUser) params.set('user', selectedUser.id)
    if (selectedDate) params.set('session', selectedDate.toString())

    goto('?' + params.toString())
  })
</script>

<div class="flex w-full touch-none flex-col items-center">
  <main class="w-full max-w-xl p-4">
    <form class="flex flex-col gap-4" use:enhance method="POST" action={`?/add`}>
      <div class="my-24 flex h-28 w-full flex-row justify-center gap-2 text-5xl caret-muted">
        <input
          class={numberInputClass}
          id="minutes"
          name="minutes"
          type="text"
          min={0}
          max={59}
          maxlength={2}
          placeholder="4"
          inputmode="numeric"
          enterkeyhint="next"
          bind:value={minutes}
        />
        <div class="flex items-center">
          <span>:</span>
        </div>
        <input
          class={numberInputClass}
          name="seconds"
          type="text"
          min={0}
          max={59}
          maxlength={2}
          placeholder="20"
          inputmode="numeric"
          enterkeyhint="next"
          bind:value={seconds}
        />
        <div class="flex items-center">
          <span>.</span>
        </div>
        <input
          class={numberInputClass}
          name="houndredths"
          type="text"
          min={0}
          max={59}
          maxlength={2}
          placeholder="69"
          inputmode="numeric"
          enterkeyhint="next"
        />
      </div>

      <div class="flex gap-4">
        <Lookup
          name="user"
          placeholder="Velg en spiller..."
          items={allUsers}
          bind:selected={selectedUser}
        />

        <Lookup
          name="track"
          placeholder="Velg en bane..."
          items={allTracks}
          bind:selected={selectedTrack}
        />
      </div>

      <Popover.Root>
        <Popover.Trigger
          class={cn(
            buttonVariants({
              variant: 'outline',
              class: 'w-full justify-start text-left font-normal',
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

      <Input type="text" name="comment" placeholder="Kommentar..." />
      <Button type="submit" disabled={!formIsValid}>Registrer tid</Button>
    </form>
  </main>
</div>
