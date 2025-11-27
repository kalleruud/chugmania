import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './app/Layout'
import { ErrorPage } from './app/pages/ErrorPage'
import Home from './app/pages/HomePage'
import SessionPage from './app/pages/SessionPage'
import SessionsPage from './app/pages/SessionsPage'
import TrackPage from './app/pages/TrackPage'
import TracksPage from './app/pages/TracksPage'
import UserPage from './app/pages/UserPage'
import UsersPage from './app/pages/UsersPage'
import { Toaster } from './components/ui/sonner'
import { AuthProvider } from './contexts/AuthContext'
import { ConnectionProvider } from './contexts/ConnectionContext'
import { DataProvider } from './contexts/DataContext'
import { ThemeProvider } from './contexts/ThemeContext'
import TimeEntryDialogProvider from './hooks/TimeEntryDrawerProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme='dark' storageKey='theme'>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ConnectionProvider>
          <DataProvider>
            <AuthProvider>
              <ErrorBoundary FallbackComponent={ErrorPage}>
                <TimeEntryDialogProvider>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route index element={<Home />} />
                      <Route path='tracks' element={<TracksPage />} />
                      <Route path='tracks/:id' element={<TrackPage />} />
                      <Route path='users' element={<UsersPage />} />
                      <Route path='users/:id' element={<UserPage />} />
                      <Route path='sessions' element={<SessionsPage />} />
                      <Route path='sessions/:id' element={<SessionPage />} />
                      {/* <Route path='admin' element={<Admin />} /> */}
                    </Route>
                  </Routes>
                  <Toaster />
                </TimeEntryDialogProvider>
              </ErrorBoundary>
            </AuthProvider>
          </DataProvider>
        </ConnectionProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)
