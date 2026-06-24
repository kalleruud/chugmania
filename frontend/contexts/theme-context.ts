import { createContext, type ReactNode } from 'react'

export type Theme = 'dark' | 'light' | 'system'

export type ThemeProviderProps = {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeProviderContext = createContext<
  ThemeProviderState | undefined
>(undefined)
