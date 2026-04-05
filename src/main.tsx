import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Help Telegram Web / desktop fill initData before the first API call.
try {
  const w = window.Telegram?.WebApp
  w?.ready()
  w?.expand()
} catch {
  /* not inside Telegram */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
