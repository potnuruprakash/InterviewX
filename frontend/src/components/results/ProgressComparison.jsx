import React from 'react'
import { TrendingUp, TrendingDown, Minus, History, Sparkles } from 'lucide-react'

export default function ProgressComparison({ progress }) {
  if (!progress) return null

  const { hasPrevious, currentScore, previousScore, delta, isPositive, summary, subDeltas = [] } = progress

  return (
    <section className="progress-comparison-section" aria-label="Longitudinal Progress Comparison">
      <div className="progress-card glass-card">
        <div className="progress-card-header">
          <div className="progress-title-wrap">
            <History size={16} className="progress-header-icon" />
            <h2 className="progress-card-title">Progress vs. Previous Interview</h2>
          </div>
          {hasPrevious && (
            <span className={`progress-badge ${isPositive ? 'badge-pos' : 'badge-neg'}`}>
              {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {delta !== null && delta >= 0 ? `+${delta} pts` : `${delta} pts`}
            </span>
          )}
        </div>

        {hasPrevious ? (
          <div className="progress-body-layout">
            <div className="progress-metric-trio">
              <div className="trio-stat-box">
                <span className="trio-label">Current Session</span>
                <span className="trio-val">{currentScore ?? '—'}</span>
              </div>

              <div className="trio-divider">→</div>

              <div className="trio-stat-box">
                <span className="trio-label">Previous Session</span>
                <span className="trio-val">{previousScore ?? '—'}</span>
              </div>

              <div className="trio-divider">=</div>

              <div className="trio-stat-box">
                <span className="trio-label">Net Score Change</span>
                <span className={`trio-val delta-val ${isPositive ? 'delta-pos' : 'delta-neg'}`}>
                  {delta !== null && delta >= 0 ? `+${delta}` : delta ?? '—'}
                </span>
              </div>
            </div>

            <p className="progress-summary-note">{summary}</p>

            {/* Sub-deltas if available */}
            {subDeltas.length > 1 && (
              <div className="progress-subdeltas-row">
                {subDeltas.map((sub, idx) => (
                  <div key={idx} className="subdelta-pill">
                    <span className="subdelta-name">{sub.label}:</span>
                    <strong className={sub.isPositive ? 'delta-pos' : 'delta-neg'}>
                      {sub.delta >= 0 ? `+${sub.delta}` : sub.delta}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="progress-empty-state">
            <Sparkles size={20} className="empty-sparkle-icon" />
            <div className="empty-text-wrap">
              <h3 className="empty-title">First Recorded Assessment</h3>
              <p className="empty-sub">
                This session establishes your historical baseline. Complete another interview to track your longitudinal score and skill mastery trends.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
