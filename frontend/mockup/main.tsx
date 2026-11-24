import { AuthProvider } from '@/contexts/AuthContext'
import { ConnectionProvider } from '@/contexts/ConnectionContext'
import { DataProvider } from '@/contexts/DataContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import TimeEntryInputProvider from '@/contexts/TimeEntryInputContext'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import Mockup from 'virtual:mockup'
import './mockup.css'
import Ready from './Ready'

function reportError(error: unknown) {
  document.body.dataset.error = String(error).replaceAll('"', "'")
}

addEventListener('error', event => reportError(event.message))
addEventListener('unhandledrejection', event => reportError(event.reason))

const root = document.getElementById('root')
if (!root) throw new Error("HTML element has no 'root'-tag.")

createRoot(root, { onUncaughtError: reportError }).render(
  <StrictMode>
    <ThemeProvider defaultTheme='dark' storageKey='theme'>
      <BrowserRouter>
        <ConnectionProvider>
          <DataProvider>
            <AuthProvider>
              <TimeEntryInputProvider>
                <Ready>
                  <Mockup />
                </Ready>
              </TimeEntryInputProvider>
            </AuthProvider>
          </DataProvider>
        </ConnectionProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)
