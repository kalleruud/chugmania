<script lang="ts">
  import SessionListView from '@/components/session/session-list-view.svelte'
  import ChevronRight from 'lucide-svelte/icons/chevron-right'
  import type { PageData } from './$types'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'

  let { data }: { data: PageData } = $props()
</script>

<HeaderBar class="px-4 py-2">
  <h1>Sessions</h1>
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
