<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Card from '$lib/components/ui/card/index.js'
  import ChevronRight from 'lucide-svelte/icons/chevron-right'
  import Flag from 'lucide-svelte/icons/flag'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<svelte:head>
  <title>{data.session.description ?? data.session.type}</title>
</svelte:head>

<div class="flex flex-col sm:gap-4 sm:py-4">
  <main class="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
    <div class="flex justify-between">
      <h1>{data.session?.date?.toLocaleDateString()}</h1>
      <form use:enhance method="POST" action={`?/create`}>
        <Button type="submit">New</Button>
      </form>
    </div>
    {#each data.entries as entry}
      <a href={'entries/' + entry.id}>
        <Card.Root class="flex items-center justify-between p-6 transition-colors hover:bg-accent">
          <div class="flex gap-2">
            <Flag class="h-6 w-6" />
            <div>
              <Card.Title>{entry.user}</Card.Title>
              <Card.Description>{entry.duration}</Card.Description>
            </div>
          </div>
          <ChevronRight class="h-6 w-6" />
        </Card.Root>
      </a>
    {/each}
  </main>
</div>
