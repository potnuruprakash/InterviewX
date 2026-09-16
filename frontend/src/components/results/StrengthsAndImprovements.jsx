import React from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, TrendingDown, ArrowUpRight, ShieldAlert, Sparkles, Target } from 'lucide-react'

export default function StrengthsAndImprovements({ strengths = [], topImprovements = [], interviewId }) {
  const practiceBaseUrl = interviewId ? `/create-interview?practiceFrom=${interviewId}` : '/create-interview'

  return (
    <section className="strengths-improvements-grid" aria-label="Strengths and Areas for Growth">
      {/* ── LEFT COLUMN: TOP 3 STRENGTHS ─────────────────────────────────── */}
      <div className="card-column glass-card strengths-card">
        <div className="column-card-header">
          <div className="header-icon-wrap icon-emerald">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <h2 className="column-card-title">Demonstrated Strengths</h2>
            <p className="column-card-subtitle">Validated competencies from your evaluated answers</p>
          </div>
        </div>

        <div className="strengths-list">
          {strengths.slice(0, 3).map((item, idx) => (
            <div key={idx} className="strength-item">
              <div className="strength-icon-bullet">
                <CheckCircle2 size={14} />
              </div>
              <div className="strength-content">
                <h3 className="strength-title">{item.title}</h3>
                <p className="strength-evidence">{item.evidence}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT COLUMN: TOP 3 RANKED IMPROVEMENTS ──────────────────────── */}
      <div className="card-column glass-card improvements-card">
        <div className="column-card-header">
          <div className="header-icon-wrap icon-amber">
            <TrendingDown size={18} />
          </div>
          <div>
            <h2 className="column-card-title">Top 3 Priority Improvements</h2>
            <p className="column-card-subtitle">Ranked by impact on interview performance</p>
          </div>
        </div>

        <div className="improvements-list">
          {topImprovements.slice(0, 3).map((item) => (
            <div key={item.id || item.priority} className="improvement-item">
              <div className="priority-rank-badge">#{item.priority}</div>
              <div className="improvement-content">
                <h3 className="improvement-issue">{item.issue}</h3>
                <p className="improvement-evidence">
                  <strong>Evidence:</strong> {item.evidence}
                </p>
                <div className="improvement-action-row">
                  <p className="improvement-action">
                    <strong>Action:</strong> {item.action}
                  </p>
                  <Link
                    to={item.practiceUrl || practiceBaseUrl}
                    className="practice-topic-btn"
                    title={`Start practice session for ${item.topic || 'this area'}`}
                  >
                    <span>Practice topic</span>
                    <ArrowUpRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
