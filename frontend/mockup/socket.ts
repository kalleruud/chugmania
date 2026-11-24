type Listener = (...args: unknown[]) => void

declare global {
  interface Window {
    mockup?: { events: [string, ...unknown[]][]; bare: boolean }
  }
}

export class Socket {
  id = 'mockup'
  connected = false
  auth: unknown = {}
  private listeners = new Map<string, Set<Listener>>()
  private replay: ReturnType<typeof setTimeout> | undefined

  on(event: string, listener: Listener) {
    const listeners = this.listeners.get(event) ?? new Set<Listener>()
    listeners.add(listener)
    this.listeners.set(event, listeners)
    return this
  }

  off(event: string, listener?: Listener) {
    if (listener) this.listeners.get(event)?.delete(listener)
    else this.listeners.delete(event)
    return this
  }

  emit() {
    return this
  }

  emitWithAck() {
    return Promise.resolve({
      success: false,
      message: 'Mockups are read-only',
    })
  }

  timeout() {
    return this
  }

  connect() {
    if (this.connected) return this
    this.connected = true
    this.replay = setTimeout(() => {
      this.dispatch('connect')
      for (const [event, ...args] of window.mockup?.events ?? [])
        this.dispatch(event, ...args)
    })
    return this
  }

  disconnect() {
    clearTimeout(this.replay)
    this.connected = false
    return this
  }

  private dispatch(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args)
  }
}

export function io() {
  return new Socket()
}
