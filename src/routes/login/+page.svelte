<script lang="ts">
  import Login from '@/components/login/login.svelte'
  import type { FormMode } from '@/components/types.server'

  let mode = $state<FormMode>('login')
</script>

<div class="flex h-dvh w-full touch-none flex-col items-center justify-center">
  <div class="mb-8 flex w-5/6 max-w-lg rounded-lg bg-secondary p-1">
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
  <div class="w-full max-w-2xl p-4 pb-36">
    <Login {mode} />
  </div>
</div>
