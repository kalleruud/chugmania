<script lang="ts">
  import { enhance } from '$app/forms'
  import Button from '@/components/ui/button/button.svelte'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import type { PageData } from './$types'

  const { data }: { data: PageData } = $props()
  const { user, session, sessionData } = data
</script>

<svelte:head>
  <title>{data.session.description ?? data.session.type}</title>
</svelte:head>

<HeaderBar class="grid px-4 py-2">
  <h1>{session.type.toLocaleUpperCase()}</h1>
  <p class="text-muted-foreground">{session.relativeDate}</p>
</HeaderBar>

<main class="mt-24 p-4">
  <div>
    {#each sessionData as { track, entries }}
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
  </div>
  {#if user.role === 'admin'}
    <form use:enhance method="post" action="?/delete">
      <input type="hidden" name="id" value={session.id} />
      <Button variant="destructive" type="submit">Slett</Button>
    </form>
  {/if}
</main>
