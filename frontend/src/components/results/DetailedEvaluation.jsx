import React from 'react'
import { Layers, Activity, ShieldCheck, CheckCircle } from 'lucide-react'

export default function DetailedEvaluation({ detailedEvaluation }) {
  if (!detailedEvaluation) return null

  const {
    technicalAccuracy,
    relevance,
    completeness,
    communication,
    depth,
    evidence,
    modalitiesUsed = {},
    skillPerformance = {},
    questionsAnswered,
    questionsSkipped,
    questionsTimedOut,
    totalQuestions,
  } = detailedEvaluation

  const subPillars = [
    { name: 'Technical Accuracy', score: technicalAccuracy, desc: 'Syntactic correctness, architectural patterns, and domain concept depth.' },
    { name: 'Answer Relevance', score: relevance, desc: 'Alignment with the interviewer prompt constraints and core question requirements.' },
    { name: 'Completeness', score: completeness, desc: 'Coverage of anticipated concepts, edge cases, and architectural trade-offs.' },
    { name: 'Communication & Pacing', score: communication, desc: 'Clear verbal delivery, conversational rate, and low verbal filler frequency.' },
    { name: 'Technical Depth', score: depth, desc: 'Granular code/architecture specifics, internal mechanisms, and complexity trade-offs.' },
    { name: 'Evidence & STAR', score: evidence, desc: 'Concrete metrics, structured situation-action-result examples, and implementation evidence.' },
  ]

  const skillsList = Object.entries(skillPerformance).filter(([_, perf]) => perf && typeof perf.score === 'number')

  return (
    <div className="detailed-evaluation-body">
      {/* ── Sub-Pillars Grid ─────────────────────────────────────────────── */}
      <div className="sub-pillars-compact-grid">
        {subPillars.map((p, idx) => {
          const score = p.score !== null && p.score !== undefined ? Math.round(Number(p.score)) : null
          return (
            <div key={idx} className="sub-pillar-card">
              <div className="sub-pillar-meta-line">
                <span className="sub-pillar-label">{p.name}</span>
                <span className="sub-pillar-score-val">{score !== null ? `${score}%` : 'Not evaluated'}</span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill fill-cyan"
                  style={{ width: `${score !== null ? Math.max(3, Math.min(100, score)) : 0}%` }}
                />
              </div>
              <span className="sub-pillar-helper">{p.desc}</span>
            </div>
          )
        })}
      </div>

      {/* ── Modality Weights Redistribution Breakdown ────────────────────── */}
      <div className="modality-weights-box">
        <span className="weights-box-title">Multimodal Fusion Weight Allocation</span>
        <div className="weights-chips-row">
          <div className={`weight-chip ${modalitiesUsed.text ? 'active' : ''}`}>
            <span className="chip-mod-name">Text & SBERT:</span>
            <span className="chip-mod-pct">{modalitiesUsed.audio && modalitiesUsed.video ? '50%' : modalitiesUsed.audio || modalitiesUsed.video ? '75%' : '100%'}</span>
          </div>
          <div className={`weight-chip ${modalitiesUsed.audio ? 'active' : 'inactive'}`}>
            <span className="chip-mod-name">Audio & Librosa:</span>
            <span className="chip-mod-pct">{modalitiesUsed.audio ? (modalitiesUsed.video ? '25%' : '25%') : '0% (Redistributed)'}</span>
          </div>
          <div className={`weight-chip ${modalitiesUsed.video ? 'active' : 'inactive'}`}>
            <span className="chip-mod-name">Video & YOLOv8:</span>
            <span className="chip-mod-pct">{modalitiesUsed.video ? (modalitiesUsed.audio ? '25%' : '25%') : '0% (Redistributed)'}</span>
          </div>
        </div>
        <p className="weights-desc">
          When audio or video inputs are unavailable, weights redistribute automatically to ensure scoring remains anchored on technical problem-solving.
        </p>
      </div>

      {/* ── Assessed Skills Performance ──────────────────────────────────── */}
      {skillsList.length > 0 && (
        <div className="assessed-skills-box">
          <span className="skills-box-title">Skill-Specific Performance:</span>
          <div className="skills-scores-grid">
            {skillsList.map(([skill, perf]) => (
              <div key={skill} className="skill-score-row">
                <span className="skill-row-name">{skill}</span>
                <div className="skill-score-bar-wrap">
                  <div
                    className="skill-score-bar-fill"
                    style={{ width: `${Math.max(4, Math.min(100, perf.score))}%` }}
                  />
                </div>
                <span className="skill-row-val">{Math.round(perf.score)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
