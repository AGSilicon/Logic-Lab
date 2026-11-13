import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('LogicLab rendering error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', padding: 32, background: '#f5f6f8', color: '#202633', fontFamily: 'system-ui, sans-serif' }}>
          <section style={{ maxWidth: 760, margin: '8vh auto', padding: 28, border: '1px solid #e5e7eb', borderRadius: 16, background: '#fff' }}>
            <h1 style={{ marginTop: 0 }}>LogicLab could not start</h1>
            <p>The app encountered a runtime error. Your saved projects have not been intentionally deleted.</p>
            <h3>Technical details</h3>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 14, background: '#f3f4f6', borderRadius: 8 }}>{this.state.error.message}\n\n{this.state.error.stack}</pre>
            <p>Copy this error and send it to the LogicLab developer so the exact cause can be fixed.</p>
            <button onClick={() => window.location.reload()} style={{ padding: '9px 14px', border: 0, borderRadius: 8, background: '#3978df', color: 'white', cursor: 'pointer' }}>Reload LogicLab</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}
