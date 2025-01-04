<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import Login from '@/components/login/login.svelte'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import UserRow from '@/components/user/user-row.svelte'
  import { User } from 'lucide-svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const { users, loggedInUser } = data
</script>

<HeaderBar class="flex items-center justify-between px-4 py-2">
  <h1>Spillere</h1>
  <a href={'users/' + loggedInUser.id}>
    <User class="size-6 text-white" />
  </a>
</HeaderBar>

<main class="mt-16 flex flex-col p-4">
  <ul class="divide-y divide-solid">
    {#each users as user, i}
      <li>
        <a href={'users/' + user.id}>
          <UserRow {user} index={i + 1} />
        </a>
      </li>
    {/each}
  </ul>
</main>

<form class="fixed mb-16 w-full p-4 bottom-safe" use:enhance method="POST" action="?/logout">
  <Button class="w-full" type="submit">Logg ut</Button>
</form>

{#if loggedInUser.isAdmin}
  <Login class="fixed bottom-20 px-4 mb-safe" mode="register" button="Kast under bussen" />
{/if}
