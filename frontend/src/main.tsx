import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { ConnectionProvider } from './contexts/ConnectionContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConnectionProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ConnectionProvider>
  </StrictMode>
)
