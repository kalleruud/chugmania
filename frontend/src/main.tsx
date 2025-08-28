import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { ConnectionProvider } from './contexts/ConnectionContext.tsx'
import './main.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConnectionProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConnectionProvider>
  </StrictMode>
)
