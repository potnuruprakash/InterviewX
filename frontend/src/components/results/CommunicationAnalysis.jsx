import React from 'react'
import { Mic, Activity, AlertCircle, Clock, Volume2, Check } from 'lucide-react'

export default function CommunicationAnalysis({ communication }) {
  if (!communication) return null

  const {
    isAvailable,
    wpm,
    wpmOptimal,
    fillerDensity,
    fillerBreakdown = {},
    pauseAverageSec,
    pauseMaxSec,
    totalWords,
    observableNote,
  } = communication

  if (!isAvailable) {
    return (
      <div className="section-unavailable-card">
        <Mic size={20} className="icon-muted" />
        <div>
          <h3 className="unavail-title">Acoustic Speech Analysis Unavailable</h3>
          <p className="unavail-sub">
            Audio recording was not active or speech audio was not provided during this session. Text-based evaluation remains fully available.
          </p>
        </div>
      </div>
    )
  }

  const fillerCount = Object.values(fillerBreakdown).reduce((a, b) => a + b, 0)
  const isFillerLow = fillerDensity !== null && fillerDensity <= 2.5

  return (
    <div className="communication-analysis-body">
      <div className="comm-stats-grid">
        {/* Speaking Pace (WPM) */}
        <div className="comm-stat-card">
          <div className="comm-stat-header">
            <span className="comm-stat-title">Speaking Rate</span>
            <Activity size={15} className="comm-stat-icon" />
          </div>
          <div className="comm-stat-main">
            <span className="comm-stat-num">{wpm ? `${wpm} WPM` : '—'}</span>
            <span className={`comm-stat-pill ${wpmOptimal ? 'pill-optimal' : 'pill-note'}`}>
              {wpmOptimal ? 'Optimal Range (130-160)' : wpm ? (wpm < 130 ? 'Measured / Deliberate' : 'Rapid Delivery') : 'Unmeasured'}
            </span>
          </div>
          <p className="comm-stat-desc">
            Measures conversational words articulated per minute across all spoken responses.
          </p>
        </div>

        {/* Filler Word Density */}
        <div className="comm-stat-card">
          <div className="comm-stat-header">
            <span className="comm-stat-title">Verbal Filler Density</span>
            <AlertCircle size={15} className="comm-stat-icon" />
          </div>
          <div className="comm-stat-main">
            <span className="comm-stat-num">
              {fillerDensity !== null ? `${fillerDensity}%` : '—'}
            </span>
            <span className={`comm-stat-pill ${isFillerLow ? 'pill-optimal' : 'pill-warning'}`}>
              {isFillerLow ? 'Low (< 2.5%)' : 'Moderate'}
            </span>
          </div>
          <p className="comm-stat-desc">
            Frequency of filled pauses (e.g., "um", "uh", "like") relative to total spoken word count ({totalWords} words).
          </p>
        </div>

        {/* Pause & Hesitation Management */}
        <div className="comm-stat-card">
          <div className="comm-stat-header">
            <span className="comm-stat-title">Pause Management</span>
            <Clock size={15} className="comm-stat-icon" />
          </div>
          <div className="comm-stat-main">
            <span className="comm-stat-num">
              {pauseAverageSec ? `~${pauseAverageSec}s` : '—'}
            </span>
            <span className="comm-stat-pill pill-note">
              Max pause: {pauseMaxSec ? `${pauseMaxSec}s` : '—'}
            </span>
          </div>
          <p className="comm-stat-desc">
            Acoustic silent intervals between phrases indicating thinking time and cadence.
          </p>
        </div>
      </div>

      {/* Filler tokens breakdown list */}
      {Object.keys(fillerBreakdown).length > 0 ? (
        <div className="filler-tokens-box">
          <span className="filler-box-title">Detected Verbal Fillers:</span>
          <div className="filler-chips-list">
            {Object.entries(fillerBreakdown).map(([token, count]) => (
              <span key={token} className="filler-chip">
                "{token}": <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="clean-signals-banner">
          <Check size={14} /> Minimal verbal fillers detected. Articulate and deliberate delivery.
        </div>
      )}

      {/* Scientific note */}
      <div className="scientific-caveat-box">
        <span>{observableNote}</span>
      </div>
    </div>
  )
}
