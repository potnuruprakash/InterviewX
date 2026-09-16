import React from 'react'
import { Award, ShieldCheck, CheckCircle2, AlertTriangle, MinusCircle, Clock, Calendar, Briefcase, Zap } from 'lucide-react'

export const ScoreRing = ({ score, size = 110, label = '', colorOverride = null }) => {
  if (score === null || score === undefined || isNaN(score)) {
    return (
      <div className="score-ring-wrap" style={{ width: size, height: size }}>
        <div className="score-ring-unavailable">
          <span>N/A</span>
          {label && <small>{label}</small>}
        </div>
      </div>
    )
  }
  const pct = Math.max(0, Math.min(100, Math.round(Number(score))))
  const color = colorOverride || (pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444')
  const r = 40
  const circ = 2 * Math.PI * r
  const dash = circ * (pct / 100)

  return (
    <div className="score-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="score-ring-text">
        <span className="ring-score" style={{ color }}>{pct}</span>
        {label && <small>{label}</small>}
      </div>
    </div>
  )
}

export default function ResultsHero({ hero, onOpenEvidence }) {
  if (!hero) return null

  const {
    role,
    interviewType,
    difficulty,
    duration,
    date,
    overallScore,
    summary,
    completionReason,
    modalityStatus,
  } = hero

  return (
    <section className="results-hero glass-card animate-fade-in" aria-label="Interview Assessment Summary">
      <div className="hero-main-layout">
        {/* Left column: Overview & metadata */}
        <div className="hero-text-column">
          <div className="hero-badge-row">
            <span className="hero-status-pill">
              <Award size={13} /> Assessment Report
            </span>
            <span className="hero-meta-tag"><Briefcase size={12} /> {role}</span>
            <span className="hero-meta-tag"><Zap size={12} /> {interviewType}</span>
            <span className="hero-meta-tag">{difficulty}</span>
            <span className="hero-meta-tag"><Clock size={12} /> {duration}</span>
            <span className="hero-meta-tag"><Calendar size={12} /> {date}</span>
          </div>

          <h1 className="hero-heading">Interview Assessment Complete</h1>
          <p className="hero-summary-text">{summary}</p>

          {/* Dynamic Modality Status Row */}
          <div className="modality-status-row" aria-label="Evaluation Modality Status">
            {/* Technical */}
            <div className={`modality-chip chip-${modalityStatus.technical.status}`}>
              <CheckCircle2 size={13} />
              <span>{modalityStatus.technical.label}</span>
            </div>

            {/* Audio */}
            <div className={`modality-chip chip-${modalityStatus.audio.status}`}>
              {modalityStatus.audio.status === 'complete' ? (
                <CheckCircle2 size={13} />
              ) : modalityStatus.audio.status === 'unavailable' ? (
                <AlertTriangle size={13} />
              ) : (
                <MinusCircle size={13} />
              )}
              <span>{modalityStatus.audio.label}</span>
            </div>

            {/* Video */}
            <div className={`modality-chip chip-${modalityStatus.video.status}`}>
              {modalityStatus.video.status === 'complete' ? (
                <CheckCircle2 size={13} />
              ) : modalityStatus.video.status === 'unavailable' ? (
                <AlertTriangle size={13} />
              ) : (
                <MinusCircle size={13} />
              )}
              <span>{modalityStatus.video.label}</span>
            </div>
          </div>

          {completionReason === 'time_expired' && (
            <div className="hero-timeout-notice">
              ⏱️ Interview completed automatically when the countdown timer reached 00:00.
            </div>
          )}
        </div>

        {/* Right column: Main Overall Score Ring */}
        <div className="hero-score-column">
          <div className="hero-score-card">
            <span className="hero-score-title">Overall Score</span>
            <ScoreRing score={overallScore} size={114} label="/ 100" />
            <div className="hero-score-footer">
              <span className="score-tier-label">
                {overallScore >= 75 ? 'Proficient' : overallScore >= 55 ? 'Developing' : 'Foundation'}
              </span>
              {onOpenEvidence && (
                <button
                  type="button"
                  className="evidence-link-btn"
                  onClick={onOpenEvidence}
                  title="View evaluation methodology and scoring model"
                >
                  <ShieldCheck size={12} /> Scoring Evidence
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
