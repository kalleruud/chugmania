<script lang="ts">
  import type { PageData } from './$types'

  const { data }: { data: PageData } = $props()
  const { session, sessionData } = data
</script>

<svelte:head>
  <title>{data.session.description ?? data.session.type}</title>
</svelte:head>

<main class="p-4">
  <h1>{session.date.toLocaleDateString()}</h1>
  <div>
    {#each sessionData as { track, entries }}
      <div class="flex flex-col gap-2 border-b py-4">
        <h2 class="text-accent-foreground">{track.name}</h2>

        <ul class="divide-y divide-solid">
          {#each entries as entry, i}
            <li>
              <div class="flex w-full justify-between py-2">
                <div class="flex gap-2">
                  <p class="font-f1 italic text-muted-foreground">{i + 1}</p>
                  <p class="font-f1 font-bold">{entry.user.name.substring(0, 3).toUpperCase()}</p>
                </div>
                <p class="font-f1">{entry.readableDuration}</p>
                <p class="w-24 font-f1 italic text-muted-foreground">{entry.readableGap}</p>
              </div>
              {#if entry.comment}
                <p class="text-muted-foreground">{entry.comment}</p>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>
</main>
