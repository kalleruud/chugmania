<script lang="ts">
  import { enhance } from '$app/forms'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { Button, buttonVariants, type ButtonVariant } from '$lib/components/ui/button/index.js'
  import { cn } from '@/utils'
  import type { Snippet } from 'svelte'

  type Props = {
    class?: string
    open?: boolean
    title?: string
    description?: string
    triggerText?: string
    triggerVariant?: ButtonVariant
    buttons?: { title: string; action?: string | (() => void); variant?: ButtonVariant }[]
    children?: Snippet
  }
  let {
    class: className,
    open = $bindable(false),
    title,
    description,
    triggerText,
    triggerVariant,
    buttons,
    children,
  }: Props = $props()
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Trigger class={buttonVariants({ variant: triggerVariant })}>
    {triggerText ?? 'Åpne'}
  </AlertDialog.Trigger>
  <AlertDialog.Content class="rounded-lg">
    {#if title || description}
      <AlertDialog.Header>
        {#if title}
          <AlertDialog.Title>{title}</AlertDialog.Title>
        {/if}
        {#if description}
          <AlertDialog.Description>{description}</AlertDialog.Description>
        {/if}
      </AlertDialog.Header>
    {/if}
    {#if children}
      <div class={cn('flex w-full justify-center gap-2 sm:justify-end', className)}>
        {@render children()}
      </div>
    {/if}
    {#if buttons}
      <AlertDialog.Footer>
        {#each buttons as b}
          {#if typeof b.action === 'function'}
            <Button variant={b.variant} onclick={b.action}>{b.title}</Button>
          {:else if typeof b.action === 'string'}
            <form use:enhance method="post" action={b.action}>
              <Button class="w-full" variant={b.variant} type="submit">{b.title}</Button>
            </form>
          {:else}
            <AlertDialog.Cancel>{b.title}</AlertDialog.Cancel>
          {/if}
        {/each}
      </AlertDialog.Footer>
    {/if}
  </AlertDialog.Content>
</AlertDialog.Root>
