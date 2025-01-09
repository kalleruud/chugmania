<script lang="ts">
  import Login from '@/components/login/login.svelte'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import UserRow from '@/components/user/user-row.svelte'
  import { User } from 'lucide-svelte'
  import type { PageData } from './$types'
  import Popup from '@/components/ui/popup/popup.svelte'

  let { data }: { data: PageData } = $props()
  const { users, loggedInUser } = $derived(data)
</script>

<HeaderBar class="flex items-center justify-between px-4 py-2">
  <h1>Spillere</h1>
  <div class="flex items-center gap-4">
    {#if loggedInUser.role === 'admin'}
      <Popup
        title="Registrer bruker"
        triggerText="Registrer"
        triggerVariant="secondary"
        buttons={[{ title: 'Lukk' }]}
      >
        <Login mode="register" button="Registrer" />
      </Popup>
    {/if}
    <a href={'users/' + loggedInUser.id}>
      <User class="size-6 text-primary" />
    </a>
  </div>
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
