<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Card from '$lib/components/ui/card/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import type { ActionData, PageData } from './$types'
  import type { FormMode } from './+page.server'

  let { form }: { data: PageData; form: ActionData } = $props()

  let mode = $state<FormMode>('lookup')
  let details = $derived(getDetails(mode))

  $effect(() => {
    if (form?.formMode) mode = form.formMode
  })

  function getDetails(mode: FormMode) {
    if (mode === 'lookup')
      return {
        title: 'Nættopp',
        description: 'Skriv inn mailen din for å logge inn eller opprette en bruker.',
        button: 'Fortsett',
      }

    if (mode === 'register')
      return {
        title: 'Registrer deg',
        description: 'Fant ingen bruker med den mailen, vil du registrere deg?',
        button: 'Registrer',
      }

    return {
      title: 'Logg inn',
      description: 'Skriv inn passordet ditt for å logge inn.',
      button: 'Logg inn',
    }
  }
</script>

<svelte:head>
  <title>Chugmania - Logg inn</title>
</svelte:head>

<div class="flex h-dvh touch-none flex-col items-center justify-center gap-4 p-4 pb-36">
  <h1 class="text-2xl">{details.title}</h1>
  <p>{details.description}</p>

  <form
    data-testid="login-form"
    id="login-form"
    class="grid w-full gap-4"
    method="POST"
    use:enhance={() =>
      async ({ update }) =>
        await update({ reset: false })}
    action={`?/${mode}`}
  >
    <fieldset class="form-group grid gap-2">
      <Label for="email">E-post</Label>
      <Input
        id="email"
        name="email"
        type="email"
        autofocus={mode === 'lookup'}
        required
        autocomplete="email"
        placeholder="jeghar@litentiss.no"
      />
    </fieldset>
    {#if mode === 'register'}
      <fieldset class="form-group grid gap-2">
        <Label for="name">Navn</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Judas"
          autofocus={mode === 'register'}
          minlength={3}
          autocomplete="name"
        />
      </fieldset>
    {/if}
    <fieldset class="form-group grid gap-2">
      <Label for="password">Passord</Label>
      <Input
        id="password"
        name="password"
        type="password"
        autofocus={mode === 'login'}
        required={mode !== 'lookup'}
        placeholder="passord123"
        minlength={6}
        autocomplete={mode === 'login' ? 'new-password' : 'current-password'}
      />
    </fieldset>
  </form>
  <Button class="w-full" form="login-form" type="submit">{details.button}</Button>
</div>
