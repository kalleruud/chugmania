import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import Layout from './app/Layout'
import Admin from './app/pages/Admin'
import Home from './app/pages/Home'
import Login from './app/pages/Login'
import Player from './app/pages/Player'
import Players from './app/pages/Players'
import Sessions from './app/pages/Sessions'
import Track from './app/pages/Track'
import Tracks from './app/pages/Tracks'
import { AuthProvider } from './contexts/AuthContext'
import { ConnectionProvider } from './contexts/ConnectionContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ConnectionProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path='tracks' element={<Tracks />} />
              <Route path='tracks/:id' element={<Track />} />
              <Route path='players' element={<Players />} />
              <Route path='players/:id' element={<Player />} />
              <Route path='sessions' element={<Sessions />} />
              <Route path='login' element={<Login />} />
              <Route path='admin' element={<Admin />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ConnectionProvider>
    </BrowserRouter>
  </StrictMode>
)
