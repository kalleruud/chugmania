<script lang="ts">
  import type { PageData } from './$types'
  import Login from '@/components/login/login.svelte'

  let { data }: { data: PageData } = $props()
  const { users, loggedInUser } = data
</script>

<main class="m-4 flex flex-col">
  <div>
    <h1>Spillere</h1>
    {#each users as user}
      <p>{user.name}</p>
    {/each}
  </div>
</main>

{#if loggedInUser.isAdmin}
  <Login class="fixed bottom-20 px-4 mb-safe" mode="register" button="Kast under bussen" />
{/if}
