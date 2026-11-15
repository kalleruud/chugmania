import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { BrowserRouter } from 'react-router'
import AppRoutes from './app/AppRoutes'
import { ErrorPage } from './app/pages/ErrorPage'
import { Toaster } from './components/ui/sonner'
import { AuthProvider } from './contexts/AuthContext'
import { ConnectionProvider } from './contexts/ConnectionContext'
import { DataProvider } from './contexts/DataContext'
import { ThemeProvider } from './contexts/ThemeContext'
import TimeEntryInputProvider from './contexts/TimeEntryInputContext'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error("HTML element has no 'root'-tag.")

createRoot(root).render(
  <StrictMode>
    <ThemeProvider defaultTheme='dark' storageKey='theme'>
      <BrowserRouter>
        <ConnectionProvider>
          <DataProvider>
            <AuthProvider>
              <ErrorBoundary FallbackComponent={ErrorPage}>
                <TimeEntryInputProvider>
                  <AppRoutes />
                  <Toaster />
                </TimeEntryInputProvider>
              </ErrorBoundary>
            </AuthProvider>
          </DataProvider>
        </ConnectionProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)
