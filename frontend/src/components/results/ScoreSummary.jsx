import React from 'react'
import { Code, MessageSquare, Brain, Target, Info, CheckCircle, AlertCircle } from 'lucide-react'

const ICON_MAP = {
  technical: Code,
  communication: MessageSquare,
  problemSolving: Brain,
  roleReadiness: Target,
}

export default function ScoreSummary({ scoreSummary = [] }) {
  if (!scoreSummary || scoreSummary.length === 0) return null

  return (
    <section className="score-summary-section" aria-label="Key Performance Dimensions">
      <div className="section-header-compact">
        <h2 className="section-title-sm">Performance Dimensions</h2>
        <span className="section-badge-muted">Core Competencies</span>
      </div>

      <div className="score-summary-grid">
        {scoreSummary.map((card) => {
          const Icon = ICON_MAP[card.key] || Target
          const hasScore = card.score !== null && card.score !== undefined && !isNaN(card.score)
          const scoreVal = hasScore ? card.score : null

          const colorClass = !hasScore
            ? 'score-muted'
            : scoreVal >= 75
            ? 'score-high'
            : scoreVal >= 55
            ? 'score-med'
            : 'score-low'

          return (
            <div key={card.key} className={`score-card glass-card ${colorClass}`}>
              <div className="score-card-header">
                <div className="card-title-wrap">
                  <Icon size={16} className="card-dimension-icon" />
                  <span className="card-dimension-name">{card.title}</span>
                </div>
                {card.isDerived && (
                  <span className="derived-pill" title="Synthesized from skill coverage and session scoring">
                    Derived
                  </span>
                )}
              </div>

              <div className="score-card-body">
                {hasScore ? (
                  <div className="card-score-display">
                    <span className="metric-score-number">{scoreVal}</span>
                    <span className="metric-score-denom">/ 100</span>
                  </div>
                ) : (
                  <div className="card-score-fallback">
                    <span className="metric-score-fallback">Not enough data</span>
                  </div>
                )}

                {/* Mini progress bar if score is available */}
                {hasScore && (
                  <div className="mini-progress-track">
                    <div
                      className="mini-progress-fill"
                      style={{ width: `${Math.max(4, Math.min(100, scoreVal))}%` }}
                    />
                  </div>
                )}

                <p className="card-takeaway-text">{card.takeaway}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
