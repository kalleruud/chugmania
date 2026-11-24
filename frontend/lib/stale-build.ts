const RELOAD_KEY = 'stale-build-reload'
const RELOAD_COOLDOWN_MS = 10_000

function readLastReload(): number {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
  } catch {
    return 0
  }
}

function writeLastReload(time: number) {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(time))
  } catch {
    return
  }
}

export function reloadOnStaleBuild() {
  window.addEventListener('vite:preloadError', event => {
    const now = Date.now()
    if (now - readLastReload() < RELOAD_COOLDOWN_MS) return
    event.preventDefault()
    writeLastReload(now)
    window.location.reload()
  })
}
