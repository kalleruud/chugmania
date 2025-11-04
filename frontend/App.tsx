import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './app/Layout'
import Home from './app/pages/Home'
import { Toaster } from './components/ui/sonner'
import { AuthProvider } from './contexts/AuthContext'
import { ConnectionProvider } from './contexts/ConnectionContext'
import { DataProvider } from './contexts/DataContext'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme='dark' storageKey='theme'>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ConnectionProvider>
          <AuthProvider>
            <DataProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  {/* <Route path='tracks' element={<Tracks />} />
                <Route path='tracks/:id' element={<Track />} />
                <Route path='players' element={<Players />} />
                <Route path='players/:id' element={<Player />} />
                <Route path='sessions' element={<Sessions />} />
                <Route path='sessions/:id' element={<Session />} />
                <Route path='login' element={<Login />} />
                <Route path='admin' element={<Admin />} /> */}
                </Route>
              </Routes>
              <Toaster />
            </DataProvider>
          </AuthProvider>
        </ConnectionProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)
