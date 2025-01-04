<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import Login from '@/components/login/login.svelte'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import UserRow from '@/components/user/user-row.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const { users, loggedInUser } = data
</script>

<HeaderBar class="px-4 py-2">
  <h1>Spillere</h1>
</HeaderBar>

<main class="mt-16 flex flex-col p-4">
  <div class="">
    {#each users as user}
      <UserRow {user} />
    {/each}
  </div>
</main>

<form class="fixed mb-16 w-full p-4 bottom-safe" use:enhance method="POST" action="?/logout">
  <Button class="w-full" type="submit">Logg ut</Button>
</form>

{#if loggedInUser.isAdmin}
  <Login class="fixed bottom-20 px-4 mb-safe" mode="register" button="Kast under bussen" />
{/if}
