<script lang="ts">
  import type { PageData } from './$types'
  import Login from '@/components/login/login.svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import { enhance } from '$app/forms'

  let { data }: { data: PageData } = $props()
  const { users, loggedInUser } = data
</script>

<main class="m-4 flex touch-none flex-col justify-between pb-12 h-screen-safe">
  <div>
    <h1>Spillere</h1>
    {#each users as user}
      <p>{user.name}</p>
    {/each}
  </div>

  <form use:enhance method="POST" action="?/logout">
    <Button class="w-full" type="submit">Logg ut</Button>
  </form>
</main>

{#if loggedInUser.isAdmin}
  <Login class="fixed bottom-20 px-4 mb-safe" mode="register" button="Kast under bussen" />
{/if}
