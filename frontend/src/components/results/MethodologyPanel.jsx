import React from 'react'
import { BookOpen, ShieldCheck, Layers, Award } from 'lucide-react'

export default function MethodologyPanel({ methodology, onOpenEvidence }) {
  if (!methodology) return null

  const { textMethod, audioMethod, videoMethod, fusionMethod } = methodology

  return (
    <div className="methodology-panel-body">
      <p className="methodology-intro">
        InterviewX employs a multi-dimensional, empirical evaluation methodology designed to provide objective, actionable feedback for engineering candidates.
      </p>

      <div className="methodology-cards-grid">
        <div className="method-detail-card">
          <span className="method-card-title">1. Technical & Semantic NLP</span>
          <p className="method-card-text">{textMethod}</p>
        </div>

        <div className="method-detail-card">
          <span className="method-card-title">2. Vocal Prosody & Cadence</span>
          <p className="method-card-text">{audioMethod}</p>
        </div>

        <div className="method-detail-card">
          <span className="method-card-title">3. Video Framing & Presence</span>
          <p className="method-card-text">{videoMethod}</p>
        </div>

        <div className="method-detail-card">
          <span className="method-card-title">4. Dynamic Multimodal Fusion</span>
          <p className="method-card-text">{fusionMethod}</p>
        </div>
      </div>

      <div className="methodology-footer-row">
        <div className="ethical-standard-note">
          <ShieldCheck size={16} className="ethical-icon" />
          <span>
            <strong>Ethical & Empirical Standard:</strong> InterviewX evaluates observable communicative and technical behaviors only. We strictly avoid subjective psychological classifications, personality scores, or deception judgments.
          </span>
        </div>

        {onOpenEvidence && (
          <button
            type="button"
            className="btn-evidence-modal-trigger"
            onClick={onOpenEvidence}
          >
            <BookOpen size={14} /> View Research Citations
          </button>
        )}
      </div>
    </div>
  )
}
