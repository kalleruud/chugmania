<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { cn } from '@/utils'
  import type { FormMode } from '../types.server'

  type Props = {
    className?: string
    title?: string
    description?: string
    button?: string
    mode?: FormMode
  }

  let { className, title, description, button = 'Kjør', mode }: Props = $props()
</script>

{#if title}
  <h1>{title}</h1>
{/if}

{#if description}
  <p class="text-muted-foreground">{description}</p>
{/if}

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

  <Button type="submit">{button}</Button>
</form>
