import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './app/Layout'
import { ErrorPage } from './app/pages/ErrorPage'
import Home from './app/pages/HomePage'
import { Toaster } from './components/ui/sonner'
import { Spinner } from './components/ui/spinner'
import { AuthProvider } from './contexts/AuthContext'
import { ConnectionProvider } from './contexts/ConnectionContext'
import { DataProvider } from './contexts/DataContext'
import { ThemeProvider } from './contexts/ThemeContext'
import TimeEntryInputProvider from './hooks/TimeEntryInputProvider'
import './index.css'

const AdminPage = lazy(() => import('./app/pages/AdminPage'))
const CreateTournamentPage = lazy(
  () => import('./app/pages/CreateTournamentPage')
)
const SessionPage = lazy(() => import('./app/pages/SessionPage'))
const SessionsPage = lazy(() => import('./app/pages/SessionsPage'))
const TrackPage = lazy(() => import('./app/pages/TrackPage'))
const TracksPage = lazy(() => import('./app/pages/TracksPage'))
const UserPage = lazy(() => import('./app/pages/UserPage'))
const UsersPage = lazy(() => import('./app/pages/UsersPage'))

function RouteLoadingFallback() {
  return (
    <main className='flex min-h-dvh-safe items-center justify-center'>
      <Spinner />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme='dark' storageKey='theme'>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ConnectionProvider>
          <DataProvider>
            <AuthProvider>
              <ErrorBoundary FallbackComponent={ErrorPage}>
                <TimeEntryInputProvider>
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <Routes>
                      <Route element={<Layout />}>
                        <Route index element={<Home />} />
                        <Route path='tracks' element={<TracksPage />} />
                        <Route path='tracks/:id' element={<TrackPage />} />
                        <Route path='users' element={<UsersPage />} />
                        <Route path='users/:id' element={<UserPage />} />
                        <Route path='sessions' element={<SessionsPage />} />
                        <Route path='sessions/:id' element={<SessionPage />} />
                        <Route path='admin' element={<AdminPage />} />
                        <Route
                          path='tournaments/create'
                          element={<CreateTournamentPage />}
                        />
                        <Route path='*' element={<Navigate to='/' replace />} />
                      </Route>
                    </Routes>
                  </Suspense>
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
