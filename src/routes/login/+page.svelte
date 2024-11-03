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
    if (!form) return
    console.debug('form', form)
    if (form.formMode) mode = form.formMode
  })

  function getDetails(mode: FormMode) {
    if (mode === 'lookup')
      return {
        title: 'Velkommen',
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

<div class="flex h-screen items-center justify-center">
  <Card.Root class="w-full max-w-sm">
    <Card.Header>
      <Card.Title class="text-2xl">{details.title}</Card.Title>
      <Card.Description>{details.description}</Card.Description>
    </Card.Header>
    <Card.Content>
      <form
        id="login-form"
        class="grid gap-4"
        method="POST"
        use:enhance={() =>
          async ({ update }) =>
            update({ reset: false })}
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
              required
              placeholder="Judas"
              minlength={2}
              autocomplete="name"
            />
          </fieldset>
        {/if}
        {#if mode !== 'lookup'}
          <fieldset class="form-group grid gap-2">
            <Label for="password">Passord</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              placeholder="passord123"
              minlength={6}
              autocomplete={mode === 'login' ? 'new-password' : 'current-password'}
            />
          </fieldset>
        {/if}
      </form>
    </Card.Content>
    <Card.Footer>
      <Button class="w-full" form="login-form" type="submit">{details.button}</Button>
    </Card.Footer>
  </Card.Root>
</div>
