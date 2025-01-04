<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import Login from '@/components/login/login.svelte'
  import UserRow from '@/components/user/user-row.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const { users, loggedInUser } = data
</script>

<main class="m-4 flex touch-none flex-col justify-between pb-12 h-screen-safe">
  <div>
    <h1>Spillere</h1>
    {#each users as user}
      <UserRow class="border-b p-4" {user} />
    {/each}
  </div>

  <form use:enhance method="POST" action="?/logout">
    <Button class="w-full" type="submit">Logg ut</Button>
  </form>
</main>

{#if loggedInUser.isAdmin}
  <Login class="fixed bottom-20 px-4 mb-safe" mode="register" button="Kast under bussen" />
{/if}
