<script lang="ts">
  import { enhance } from '$app/forms'
  import SessionListView from '@/components/session/session-list-view.svelte'
  import Button from '@/components/ui/button/button.svelte'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import ChevronRight from 'lucide-svelte/icons/chevron-right'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const { user } = data
  let addOpen = $state(false)
</script>

<HeaderBar class="flex items-center justify-between px-4 py-2">
  <h1>Sessions</h1>
  {#if user.role === 'admin'}
    <form use:enhance method="post" action="?/create">
      <Button variant="secondary" type="submit">Create tournament</Button>
    </form>
  {/if}
</HeaderBar>

<main class="mt-16 flex flex-col gap-4 p-4">
  {#each data.sessions as session}
    <a
      href={'sessions/' + session.id}
      class="flex items-center justify-between gap-1 rounded-lg border p-4 transition-colors sm:hover:bg-accent"
    >
      <SessionListView class="w-full" {session} />
      <ChevronRight class="size-6" />
    </a>
  {/each}
</main>
