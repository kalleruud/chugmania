<script lang="ts">
  import type { PageData } from './$types'

  const { data }: { data: PageData } = $props()
  const { session, sessionData } = data
</script>

<svelte:head>
  <title>{data.session.description ?? data.session.type}</title>
</svelte:head>

<main class="p-4">
  <h1>{session.type.toLocaleUpperCase()}</h1>
  <p class="text-muted-foreground">{session.relativeDate}</p>

  <div>
    {#each sessionData as { track, entries }}
      <div class="mb-4 flex flex-col gap-2 border-b py-4 text-sm">
        <h2 class="text-accent-foreground">{track.name}</h2>

        <ul class="divide-y divide-solid">
          {#each entries as entry, i}
            <li class="py-2">
              <div class="flex w-full justify-between font-f1">
                <div class="flex gap-2">
                  <p class="italic text-muted-foreground">{i + 1}</p>
                  <p class="font-bold">{entry.user.name.substring(0, 3).toUpperCase()}</p>
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
  </div>
</main>
