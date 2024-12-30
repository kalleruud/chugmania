<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import type { FormMode } from './+page.server'

  let mode = $state<FormMode>('login')
  let details = $derived(
    mode === 'register'
      ? {
          title: 'Registrer deg',
          description: 'Dytt inn infoen din, så er du klar til å chugge på null tid',
          button: 'Kroppen min er klar',
        }
      : {
          title: 'Nættopp',
          description: 'Skriv inn mailen din for å logge inn',
          button: 'Trykk her hvis du har liten tiss',
        }
  )
</script>

<svelte:head>
  <title>Chugmania - {details.title}</title>
</svelte:head>

<div class="flex h-dvh w-full touch-none flex-col items-center justify-center">
  <div class="w-full max-w-2xl p-4 pb-36">
    <div class="mx-8 mb-8 flex rounded-lg bg-secondary p-1">
      <button
        type="button"
        class="flex-1 rounded-sm py-1"
        class:bg-background={mode === 'login'}
        class:text-muted-foreground={mode !== 'login'}
        onclick={() => (mode = 'login')}
      >
        <p>Logg inn</p>
      </button>
      <button
        type="button"
        class="flex-1 rounded-sm py-1"
        class:bg-background={mode === 'register'}
        class:text-muted-foreground={mode !== 'register'}
        onclick={() => (mode = 'register')}
      >
        Registrer
      </button>
    </div>
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
        <p>E-post</p>
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
          <p>Navn</p>
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
        <p>Passord</p>
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

      <Button type="submit">{details.button}</Button>
    </form>
  </div>
</div>
