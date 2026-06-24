import { useState } from 'react'
import {
  ThemeProviderContext,
  type Theme,
  type ThemeProviderProps,
} from './theme-context'

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light' || value === 'system'
}

function applyTheme(theme: Theme) {
  const root = globalThis.document.documentElement

  root.classList.remove('light', 'dark')

  if (theme === 'system') {
    root.classList.add(
      globalThis.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    )
    return
  }

  root.classList.add(theme)
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: Readonly<ThemeProviderProps>) {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem(storageKey)
    const initialTheme = isTheme(storedTheme) ? storedTheme : defaultTheme
    applyTheme(initialTheme)
    return initialTheme
  })

  const context = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      applyTheme(theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={context}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
