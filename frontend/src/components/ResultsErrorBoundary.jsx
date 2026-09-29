import React from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

export class ResultsErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ResultsErrorBoundary] Uncaught render exception in Results route:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    } else {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="results-page">
          <div className="results-container" style={{ paddingTop: '80px', alignItems: 'center' }}>
            <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '40px 32px', textAlign: 'center' }}>
              <div style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}>
                <AlertCircle size={44} color="#f87171" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 10px', color: '#ffffff' }}>
                Something went wrong loading your results
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
                An unexpected error occurred while rendering the assessment report. You can try refreshing the view or returning to your dashboard.
              </p>
              {this.state.error?.message && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  fontSize: '12px',
                  color: '#fca5a5',
                  fontFamily: 'monospace',
                  textAlign: 'left',
                  overflowX: 'auto',
                  wordBreak: 'break-word'
                }}>
                  {this.state.error.message}
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} /> Retry
                </button>
                <Link
                  to="/dashboard"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Home size={14} /> Return to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ResultsErrorBoundary
