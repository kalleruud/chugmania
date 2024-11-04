<script lang="ts">
  import '../app.css'
  import '@fontsource/titillium-web'
  import { ModeWatcher } from 'mode-watcher'

  let { children } = $props()
</script>

<ModeWatcher />
{@render children()}
