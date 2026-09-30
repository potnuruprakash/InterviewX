import { useState, useEffect, memo } from 'react'
import { Brain, CheckCircle2, Circle, AlertCircle, RefreshCw } from 'lucide-react'
import './InterviewLoadingScreen.css'

/**
 * Enterprise-grade Interview Setup Loading Screen
 *
 * Provides a reassuring, progress-driven loading experience with:
 * - Clear candidate-facing stage steps (no developer jargon)
 * - Animated step completion
 * - Graceful timeout status if initialization takes longer
 * - Clean dark/light theme integration
 */
function InterviewLoadingScreen({ onRetry }) {
  const [activeStep, setActiveStep] = useState(0)
  const [isDelayed, setIsDelayed] = useState(false)

  const steps = [
    { id: 'config', label: 'Interview configuration' },
    { id: 'strategy', label: 'Question strategy' },
    { id: 'workspace', label: 'Evaluation environment' },
  ]

  useEffect(() => {
    // Step progression animation (subtle and reassuring)
    const t1 = setTimeout(() => setActiveStep(1), 700)
    const t2 = setTimeout(() => setActiveStep(2), 1600)
    const t3 = setTimeout(() => setIsDelayed(true), 8000)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  return (
    <div className="interview-loading-root animate-fade-in" role="status" aria-live="polite">
      <div className="loading-card glass-card">
        {/* Brand Icon Header */}
        <div className="loading-brand-header">
          <div className="loading-logo-pill">
            <Brain size={26} className="loading-brand-icon" />
          </div>
          <span className="loading-brand-name">InterviewX</span>
        </div>

        {/* Primary Status Title & Subtitle */}
        <div className="loading-text-group">
          <h2 className="loading-main-title">Preparing your interview session</h2>
          <p className="loading-main-subtitle">
            Tailoring the interactive workspace and adaptive question track to your profile…
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div className="loading-progress-bar-track">
          <div className={`loading-progress-bar-fill step-${activeStep}`} />
        </div>

        {/* Step-by-Step Status Checklist */}
        <div className="loading-checklist">
          {steps.map((step, idx) => {
            const isCompleted = activeStep > idx
            const isCurrent = activeStep === idx

            return (
              <div
                key={step.id}
                className={`loading-step-item ${
                  isCompleted ? 'is-complete' : isCurrent ? 'is-active' : 'is-pending'
                }`}
              >
                <div className="step-icon-wrap">
                  {isCompleted ? (
                    <CheckCircle2 size={16} className="step-icon-complete" />
                  ) : isCurrent ? (
                    <span className="step-spinner-dot" />
                  ) : (
                    <Circle size={15} className="step-icon-pending" />
                  )}
                </div>
                <span className="step-label">{step.label}</span>
                {isCompleted && <span className="step-badge">Ready</span>}
                {isCurrent && <span className="step-badge badge-active">Preparing…</span>}
              </div>
            )
          })}
        </div>

        {/* Gentle Timeout Message if loading takes longer */}
        {isDelayed && (
          <div className="loading-delayed-notice animate-fade-in">
            <AlertCircle size={14} className="delayed-icon" />
            <span>Still preparing your interview. Finalizing questions…</span>
            {onRetry && (
              <button type="button" className="btn-retry-session" onClick={onRetry}>
                <RefreshCw size={12} />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(InterviewLoadingScreen)
