<script lang="ts">
  import SessionListView from '@/components/session/session-list-view.svelte'
  import ChevronRight from 'lucide-svelte/icons/chevron-right'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<div class="flex flex-col sm:gap-4 sm:py-4">
  <main class="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
    <div class="flex justify-between">
      <h1>Sessions</h1>
    </div>
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
</div>
