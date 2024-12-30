<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { cn } from '@/utils'
  import type { FormMode } from '../types.server'

  type Props = {
    className?: string
    mode?: FormMode
  }

  let { className, mode }: Props = $props()

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

<h1>{details.title}</h1>
<p class="text-muted-foreground">{details.description}</p>

<form
  data-testid="login-form"
  id="login-form"
  class={cn(className, 'mt-4 grid w-full gap-4')}
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
      placeholder="passord123"
      minlength={6}
      autocomplete={mode === 'login' ? 'new-password' : 'current-password'}
    />
  </fieldset>

  <Button type="submit">{details.button}</Button>
</form>
