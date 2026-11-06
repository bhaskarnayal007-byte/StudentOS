import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { StoreProvider } from './store.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './theme.css'
import { checkForLiveUpdate } from './lib/liveUpdate.js'

// Pages load on demand (App.jsx). After a deploy, a tab still running the old
// version asks for chunk files that no longer exist; reloading picks up the new
// version instead of showing the crash screen. At most one reload a minute, so
// a file missing for some other reason can't cause a reload loop.
window.addEventListener('vite:preloadError', event => {
  const KEY = 'stratus-chunk-reload-at'
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 60_000) return
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

// Entry point: find the #root div in index.html, and render the app into it.
// StoreProvider wraps App so every component inside can call useStore().
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
)

checkForLiveUpdate()
