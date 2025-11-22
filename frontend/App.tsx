import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './app/Layout'
import { ErrorPage } from './app/pages/ErrorPage'
import Home from './app/pages/Home'
import TrackPage from './app/pages/TrackPage'
import TracksPage from './app/pages/TracksPage'
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
          <AuthProvider>
            <DataProvider>
              <ErrorBoundary FallbackComponent={ErrorPage}>
                <TimeEntryDialogProvider>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route index element={<Home />} />
                      <Route path='tracks' element={<TracksPage />} />
                      <Route path='tracks/:id' element={<TrackPage />} />
                      {/* <Route path='players' element={<Players />} /> */}
                      {/* <Route path='players/:id' element={<Player />} /> */}
                      {/* <Route path='sessions' element={<Sessions />} /> */}
                      {/* <Route path='sessions/:id' element={<Session />} /> */}
                      {/* <Route path='login' element={<Login />} /> */}
                      {/* <Route path='admin' element={<Admin />} /> */}
                    </Route>
                  </Routes>
                  <Toaster />
                </TimeEntryDialogProvider>
              </ErrorBoundary>
            </DataProvider>
          </AuthProvider>
        </ConnectionProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)
