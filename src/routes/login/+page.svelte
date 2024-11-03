<script lang="ts">
  import { enhance } from '$app/forms'
  import type { ActionData, PageData } from './$types'
  import type { FormMode } from './+page.server'

  let { form }: { data: PageData; form: ActionData } = $props()

  let mode = $state<FormMode>('lookup')
  const submitButtonText = $derived(
    mode == 'lookup' ? 'Fortsett' : mode === 'register' ? 'Registrer' : 'Logg inn'
  )

  $effect(() => {
    if (!form) return
    console.debug('form', form)
    if (form.formMode) mode = form.formMode
  })
</script>

<svelte:head>
  <title>Logg inn</title>
</svelte:head>

<div class="auth-page">
  <div class="page container">
    <div class="row">
      <div class="col-md-6 offset-md-3 col-xs-12">
        <h1 class="text-xs-center">Logg inn</h1>
        <form
          method="POST"
          use:enhance={() =>
            async ({ update }) =>
              update({ reset: false })}
          action={`?/${mode}`}
        >
          <fieldset class="form-group">
            <input
              class="form-control form-control-lg"
              name="email"
              type="email"
              required
              placeholder="E-post"
              autocomplete="email"
            />
          </fieldset>
          <fieldset class="form-group">
            <input
              class="form-control form-control-lg"
              name="name"
              type="text"
              hidden={mode !== 'register'}
              required={mode === 'register'}
              placeholder="Navn"
              autocomplete="name"
            />
          </fieldset>
          <fieldset class="form-group">
            <input
              class="form-control form-control-lg"
              name="password"
              type="password"
              hidden={mode === 'lookup'}
              required={mode !== 'lookup'}
              placeholder="Passord"
              minlength={8}
              autocomplete={'current-password'}
            />
          </fieldset>
          <button class="btn btn-lg btn-primary pull-xs-right">{submitButtonText}</button>
        </form>
      </div>
    </div>
  </div>
</div>
