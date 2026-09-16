import React from 'react'
import { Video, VideoOff, ShieldCheck, Eye, CheckCircle2, AlertCircle } from 'lucide-react'

export default function VideoPresenceAnalysis({ video }) {
  if (!video) return null

  const {
    isAvailable,
    faceScore,
    personScore,
    goodFramingScore,
    multiplePersonScore,
    cameraGazeRatio,
    cameraOrientation,
    expressionDistribution,
    dominantExpression,
    expressionTransitions,
    modelConfidence,
    observableNotes = [],
    modelAuditNote,
    unavailableReason,
  } = video

  if (!isAvailable) {
    return (
      <div className="section-unavailable-card">
        <VideoOff size={24} className="icon-muted" />
        <div className="unavail-content">
          <h3 className="unavail-title">Video Analysis Unavailable</h3>
          <p className="unavail-sub">{unavailableReason}</p>
          <span className="unavail-footnote">
            Your technical performance and verbal evaluations remain active and unaffected.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="video-analysis-body">
      <div className="video-tables-grid">
        {/* Table 1: Physical Presence & Framing (YOLOv8) */}
        <div className="video-sub-card">
          <span className="video-sub-title">VIDEO & CANDIDATE PRESENCE (YOLOv8)</span>
          <div className="presence-stats-table">
            <div className="presence-stat-row">
              <span className="p-row-label">Face visible</span>
              <span className="p-row-val">{faceScore !== null ? `${faceScore}%` : '—'}</span>
            </div>
            <div className="presence-stat-row">
              <span className="p-row-label">Person detected</span>
              <span className="p-row-val">{personScore !== null ? `${personScore}%` : '—'}</span>
            </div>
            <div className="presence-stat-row">
              <span className="p-row-label">Horizontal framing</span>
              <span className="p-row-val">{goodFramingScore !== null ? `${goodFramingScore}%` : '—'}</span>
            </div>
            <div className="presence-stat-row">
              <span className="p-row-label">Multiple-person frames</span>
              <span className="p-row-val">{multiplePersonScore !== null ? `${multiplePersonScore}%` : '0%'}</span>
            </div>
            <div className="presence-stat-row">
              <span className="p-row-label">Camera orientation (centered)</span>
              <span className="p-row-val">
                {cameraOrientation?.center !== undefined
                  ? `${Math.round(cameraOrientation.center * 100)}%`
                  : cameraGazeRatio !== null
                  ? `${cameraGazeRatio}%`
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Table 2: Observable Expressions Over Time */}
        <div className="video-sub-card">
          <span className="video-sub-title">OBSERVABLE EXPRESSIONS TIMELINE</span>
          {expressionDistribution && Object.keys(expressionDistribution).length > 0 ? (
            <div className="presence-stats-table">
              {Object.entries(expressionDistribution).map(([expr, ratio]) => (
                <div key={expr} className="presence-stat-row">
                  <span className="p-row-label" style={{ textTransform: 'capitalize' }}>
                    {expr.replace('_', ' ')}
                  </span>
                  <span className="p-row-val">{Math.round(Number(ratio) * 100)}%</span>
                </div>
              ))}
              <div className="presence-stat-row sub-row-accent">
                <span className="p-row-label">Dominant Expression</span>
                <span className="p-row-val" style={{ textTransform: 'capitalize', color: '#67e8f9' }}>
                  {dominantExpression ? dominantExpression.replace('_', ' ') : 'Neutral'}
                </span>
              </div>
              <div className="presence-stat-row sub-row-accent">
                <span className="p-row-label">Expression Transitions</span>
                <span className="p-row-val">{expressionTransitions} transitions</span>
              </div>
              {modelConfidence !== null && (
                <div className="presence-stat-row sub-row-muted">
                  <span className="p-row-label">Model Classification Confidence</span>
                  <span className="p-row-val">{Math.round(modelConfidence * 100)}%</span>
                </div>
              )}
            </div>
          ) : (
            <p className="no-data-hint">Expression timeline logged across sampled video frames.</p>
          )}
        </div>
      </div>

      {/* Observable Notes */}
      {observableNotes.length > 0 && (
        <div className="observable-notes-box">
          <span className="notes-box-title">PHYSICAL OBSERVATIONS:</span>
          <ul className="notes-bullet-list">
            {observableNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Audit disclaimer box */}
      <div className="audit-disclaimer-box">
        <div className="audit-disclaimer-header">
          <ShieldCheck size={14} color="#38bdf8" />
          <strong>Model & Dataset Verification Statement</strong>
        </div>
        <p>{modelAuditNote}</p>
        <small>
          YOLOv8 is operating in object detection mode (<code>task: detect</code>) for candidate presence and framing. Model classification confidence measures statistical certainty of image features, never candidate emotional confidence or competence.
        </small>
      </div>
    </div>
  )
}
