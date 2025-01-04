<script lang="ts">
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
    <User class="size-6 text-primary" />
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

{#if loggedInUser.isAdmin}
  <Login class="fixed bottom-20 px-4 mb-safe" mode="register" button="Kast under bussen" />
{/if}
