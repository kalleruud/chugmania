<script lang="ts">
  import { enhance } from '$app/forms'
  import Button from '@/components/ui/button/button.svelte'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import Input from '@/components/ui/input/input.svelte'
  import { ConeIcon, PencilIcon, TrophyIcon } from 'lucide-svelte'
  import { tick } from 'svelte'
  import type { PageData } from './$types'

  const { data }: { data: PageData } = $props()
  const { user, session, sessionData } = $derived(data)
  let isEditingTitle = $state(false)
  let titleEditRef = $state<HTMLElement>(null!)

  function onClickEdit() {
    isEditingTitle = true
    tick().then(() => titleEditRef?.focus())
  }
</script>

<svelte:head>
  <title>{data.session.description ?? data.session.type}</title>
</svelte:head>

<HeaderBar class="grid px-4 py-2">
  <div class="flex items-center gap-2">
    {#if session.type === 'practice'}
      <ConeIcon class="size-8" />
    {:else}
      <TrophyIcon class="size-8" />
    {/if}
    {#if isEditingTitle}
      <form
        class="flex items-center gap-4"
        use:enhance={() => {
          return ({ update }) => {
            isEditingTitle = false
            update()
          }
        }}
        method="post"
        action="?/update"
      >
        <input type="hidden" name="id" value={session.id} />
        <Input
          bind:ref={titleEditRef}
          name="title"
          type="text"
          value={session.description}
          class="m-1 font-f1 font-black uppercase"
          style="font-size: xx-large"
          placeholder={session.type}
        />
        <Button type="submit">Lagre</Button>
      </form>
    {:else}
      <div class="flex items-center gap-2">
        <h1 class="uppercase">{session.description ?? session.type}</h1>
        {#if user.role === 'admin'}
          <button class="p-2" onclick={onClickEdit}>
            <PencilIcon class="size-4" />
          </button>
        {/if}
      </div>
    {/if}
  </div>
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
