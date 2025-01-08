<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import HeaderBar from '@/components/ui/header-bar/header-bar.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const { user, currentUser, isCurrentUser } = $derived(data)
</script>

<svelte:head>
  <title>Chugmania | {user.name}</title>
</svelte:head>

<HeaderBar class="px-4 py-2">
  <h1>{user.name}</h1>
  <p class="font-f1 italic text-muted-foreground">{user.readableRole}</p>
</HeaderBar>

<main class="mt-20 grid gap-8 p-4">
  {#if isCurrentUser || currentUser.role === 'admin'}
    <form class="grid gap-4" use:enhance method="POST" action="?/update">
      <input type="hidden" name="id" value={user.id} />

      <fieldset class="form-group grid gap-2">
        <label for={'email'}>E-post</label>
        <Input id={'email'} name={'email'} placeholder={user.email} />
      </fieldset>

      <fieldset class="form-group grid gap-2">
        <label for={'name'}>Navn</label>
        <Input id={'name'} name={'name'} placeholder={user.name} />
      </fieldset>

      <fieldset class="form-group grid gap-2">
        <label for={'shortName'}>Kort navn</label>
        <Input
          class="uppercase"
          id={'shortName'}
          name={'shortName'}
          minlength={3}
          maxlength={3}
          placeholder={user.shortName}
        />
      </fieldset>

      <fieldset class="form-group grid gap-2">
        <label for={'password'}>Passord</label>
        <Input id={'password'} name={'password'} type="password" placeholder="••••••••" />
      </fieldset>

      <Button class="mt-4" type="submit">Dunk inn oppdatert data</Button>
    </form>

    <form class="flex w-full justify-center" use:enhance method="POST" action="?/logout">
      <Button variant="secondary" type="submit">Logg ut</Button>
    </form>
  {/if}

  {#if currentUser.role === 'admin' && user.role !== 'admin'}
    <form class="flex w-full justify-center" use:enhance method="POST" action="?/delete">
      <Button variant="destructive" type="submit">Yeet user</Button>
    </form>
  {/if}
</main>
