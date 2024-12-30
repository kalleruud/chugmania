<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import type { FormMode } from './+page.server'

  let mode = $state<FormMode>('login')
  let details = $derived(
    mode === 'register'
      ? {
          title: 'Registrer deg',
          description: 'Dytt inn infoen din, så er du klar til å chugge på null tid.',
          button: 'Registrer',
        }
      : {
          title: 'Nættopp',
          description: 'Skriv inn mailen din for å logge inn.',
          button: 'Logg inn',
        }
  )
</script>

<svelte:head>
  <title>Chugmania - {details.title}</title>
</svelte:head>

<div class="fixed bottom-32 w-full touch-none select-none">
  <div class="rounded-lg bg-secondary p-1">
    <button
      type="button"
      class="rounded-sm py-1"
      class:bg-background={mode === 'login'}
      class:text-muted-foreground={mode !== 'login'}
      onclick={() => (mode = 'login')}
    >
      Logg inn
    </button>
    <button
      type="button"
      class="rounded-sm py-1"
      class:bg-background={mode === 'register'}
      class:text-muted-foreground={mode !== 'register'}
      onclick={() => (mode = 'register')}
    >
      Registrer
    </button>
  </div>
</div>
<div class="flex h-dvh touch-none flex-col justify-center p-4 pb-36">
  <h1>{details.title}</h1>
  <p class="text-muted-foreground">{details.description}</p>

  <form
    data-testid="login-form"
    id="login-form"
    class="mt-4 grid w-full gap-4"
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
        required={mode !== 'lookup'}
        placeholder="passord123"
        minlength={6}
        autocomplete={mode === 'login' ? 'new-password' : 'current-password'}
      />
    </fieldset>

    <Button class="w-full" type="submit">{details.button}</Button>
  </form>
</div>
