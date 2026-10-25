import { Component } from 'react'

/**
 * The last line of defence. Without it, any error thrown while rendering (or
 * in an effect) unmounts the whole app and leaves a blank screen with no way
 * out — which is what a finished timer did on Android. This shows a message
 * and a way back instead. Your data is untouched: it lives in storage, not in
 * the React tree that just failed.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Student OS crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="legal" role="alert">
        <h1>Something went wrong</h1>
        <p>Student OS hit an error and stopped. Your notes, tasks and timers are saved.</p>
        <p className="muted">{String(this.state.error?.message ?? this.state.error)}</p>
        <div className="row">
          <button className="primary" onClick={() => window.location.reload()}>Reload</button>
          <button onClick={() => window.location.assign('/')}>Go home</button>
        </div>
      </main>
    )
  }
}
