import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import Layout from './app/Layout'
import Home from './app/pages/Home'
import Login from './app/pages/Login'
import Players from './app/pages/Players'
import Tracks from './app/pages/Tracks'
import Track from './app/pages/Track'
import { AuthProvider } from './contexts/AuthContext'
import { ConnectionProvider } from './contexts/ConnectionContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConnectionProvider>
      <AuthProvider>
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path='tracks' element={<Tracks />} />
              <Route path='tracks/:id' element={<Track />} />
              <Route path='players' element={<Players />} />
              <Route path='login' element={<Login />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConnectionProvider>
  </StrictMode>
)
