<script lang="ts">
  import { enhance } from '$app/forms'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import Lookup from '@/components/lookup/lookup.svelte'
  import Button from '@/components/ui/button/button.svelte'
  import Input from '@/components/ui/input/input.svelte'
  import type { PageData } from './$types'

  const { data }: { data: PageData } = $props()

  let track = $state(data.allTracks.find(t => t.label === $page.url.searchParams.get('track')))
  let session = $state(
    data.allSessions.find(
      s => s.id === ($page.url.searchParams.get('session') ?? data.mostRecentSession?.id)
    )
  )
  let user = $state(
    data.allUsers.find(u => u.id === ($page.url.searchParams.get('user') ?? data.user.id))
  )

  let minutes = $state(undefined as number | undefined)
  let seconds = $state(undefined as number | undefined)

  let formIsValid = $derived(() => !!track && !!user && !!session && (minutes || seconds))

  const numberInputClass =
    'flex w-20 rounded-md border bg-transparent text-center outline-none placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

  $effect(() => {
    let params = new URLSearchParams()
    if (track) params.set('track', track.label)
    if (user) params.set('user', user.id)
    if (session) params.set('session', session.id)

    goto('?' + params.toString())
  })
</script>

<div class="flex flex-col">
  <main class="gap-4 p-4">
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
          placeholder="0"
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
          placeholder="00"
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
          placeholder="00"
          inputmode="numeric"
          enterkeyhint="next"
        />
      </div>
      <Lookup
        name="user"
        placeholder="Velg en bruker..."
        items={data.allUsers}
        bind:selected={user}
      />
      <Lookup
        name="session"
        placeholder="Velg en session..."
        items={data.allSessions}
        bind:selected={session}
      />
      <Lookup
        name="track"
        placeholder="Velg en bane..."
        items={data.allTracks}
        bind:selected={track}
      />
      <Input type="text" name="comment" placeholder="Kommentar..." />
      <Button type="submit" disabled={!formIsValid()}>Registrer tid</Button>
    </form>
  </main>
</div>
