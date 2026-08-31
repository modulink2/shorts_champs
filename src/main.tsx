import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import Root from './Root'
import { AuthProvider } from './AuthContext'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>
)
