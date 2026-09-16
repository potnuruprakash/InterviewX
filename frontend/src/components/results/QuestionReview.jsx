import React, { useState } from 'react'
import {
  ChevronDown, ChevronUp, CheckCircle, SkipForward, Clock,
  Code, MessageSquare, AlertCircle, Sparkles, Check, HelpCircle
} from 'lucide-react'

const StarPill = ({ label, component }) => {
  const status = component?.status || 'not_detected'
  const isDetected = status === 'detected'
  const isPartial = status === 'partially_detected'

  const icon = isDetected ? '✓' : isPartial ? '△' : '✕'
  const pillClass = isDetected ? 'star-detected' : isPartial ? 'star-partial' : 'star-missed'

  return (
    <div className={`star-badge-pill ${pillClass}`} title={component?.snippet || 'Cue analysis'}>
      <span className="star-icon">{icon}</span>
      <span className="star-label">{label}</span>
    </div>
  )
}

export default function QuestionReview({ questions = [] }) {
  // Expand first question by default
  const [expandedQuestions, setExpandedQuestions] = useState({ 0: true })

  if (!questions || questions.length === 0) return null

  const toggleQuestion = (idx) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }))
  }

  const expandAll = () => {
    const all = {}
    questions.forEach((_, i) => (all[i] = true))
    setExpandedQuestions(all)
  }

  const collapseAll = () => {
    setExpandedQuestions({})
  }

  const answeredCount = questions.filter((q) => q.status === 'ANSWERED').length
  const skippedCount = questions.filter((q) => q.status === 'SKIPPED').length
  const timeoutCount = questions.filter((q) => q.status === 'TIMEOUT').length

  return (
    <section className="question-review-section" aria-label="Question by Question Breakdown">
      <div className="section-header-compact">
        <div className="section-title-wrap">
          <MessageSquare size={18} className="icon-glow-purple" />
          <div>
            <h2 className="section-title-sm">Question Review & Granular Feedback</h2>
            <p className="section-desc-xs">Expand any response to inspect answer depth and scoring evidence</p>
          </div>
        </div>

        <div className="accordion-action-group">
          <div className="status-counter-chips">
            <span className="counter-chip chip-answered">✓ {answeredCount} Answered</span>
            {skippedCount > 0 && <span className="counter-chip chip-skipped">↷ {skippedCount} Skipped</span>}
            {timeoutCount > 0 && <span className="counter-chip chip-timeout">⏱ {timeoutCount} Timed out</span>}
          </div>
          <div className="toggle-btns">
            <button type="button" className="btn-text-ghost" onClick={expandAll}>Expand all</button>
            <span className="btn-divider">|</span>
            <button type="button" className="btn-text-ghost" onClick={collapseAll}>Collapse all</button>
          </div>
        </div>
      </div>

      <div className="questions-accordion-list">
        {questions.map((q, idx) => {
          const isExpanded = Boolean(expandedQuestions[idx])
          const isSkipped = q.status === 'SKIPPED'
          const isTimeout = q.status === 'TIMEOUT'
          const isAnswered = q.status === 'ANSWERED'

          return (
            <div key={q.id || idx} className={`question-accordion-card glass-card ${isExpanded ? 'is-expanded' : ''}`}>
              {/* ── Accordion Header / Trigger ───────────────────────────── */}
              <button
                type="button"
                className="q-accordion-header"
                onClick={() => toggleQuestion(idx)}
                aria-expanded={isExpanded}
                aria-controls={`q-details-${idx}`}
              >
                <div className="q-header-left">
                  <span className="q-number-pill">Q{q.number}</span>
                  <span className="q-prompt-preview">{q.questionText}</span>
                </div>

                <div className="q-header-right">
                  {/* Status Badge */}
                  {isAnswered && (
                    <span className="q-status-badge badge-answered">
                      <CheckCircle size={12} />
                      <span>Score: <strong>{q.score !== null ? q.score : '—'}</strong></span>
                    </span>
                  )}
                  {isSkipped && (
                    <span className="q-status-badge badge-skipped">
                      <SkipForward size={12} />
                      <span>Skipped</span>
                    </span>
                  )}
                  {isTimeout && (
                    <span className="q-status-badge badge-timeout">
                      <Clock size={12} />
                      <span>Timed out</span>
                    </span>
                  )}

                  <span className="accordion-chevron-icon">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </div>
              </button>

              {/* ── Expandable Details Panel ─────────────────────────────── */}
              {isExpanded && (
                <div id={`q-details-${idx}`} className="q-accordion-content animate-fade-in">
                  {/* Full Prompt & Meta Tags */}
                  <div className="q-prompt-box">
                    <div className="q-meta-row">
                      <span className="q-pill q-pill-category">{q.category}</span>
                      <span className="q-pill q-pill-diff">{q.difficulty}</span>
                      {q.targetSkill && <span className="q-pill q-pill-skill">Skill: {q.targetSkill}</span>}
                    </div>
                    <p className="q-full-text">{q.questionText}</p>
                  </div>

                  {/* Candidate Response */}
                  <div className="q-response-box">
                    <span className="box-section-title">Candidate Response:</span>
                    {isSkipped ? (
                      <p className="q-skipped-notice">
                        This question was skipped by the candidate. Skipped questions are not penalized as 0% failures.
                      </p>
                    ) : isTimeout ? (
                      <p className="q-timeout-notice">
                        Interview countdown reached 00:00 before this question was answered.
                      </p>
                    ) : q.code ? (
                      <pre className="q-code-snippet"><code>{q.code}</code></pre>
                    ) : q.answerText ? (
                      <p className="q-answer-text">{q.answerText}</p>
                    ) : (
                      <p className="q-empty-answer">No answer text recorded.</p>
                    )}
                  </div>

                  {/* Evaluation Metrics & Feedback if answered */}
                  {isAnswered && (
                    <>
                      {/* Metric Bar Row */}
                      {(q.relevanceScore !== null || q.conceptCoverage !== null) && (
                        <div className="q-metric-chips-row">
                          {q.relevanceScore !== null && (
                            <div className="q-metric-chip">
                              <span className="metric-chip-label">Relevance:</span>
                              <span className="metric-chip-val">{q.relevanceScore}%</span>
                            </div>
                          )}
                          {q.conceptCoverage !== null && (
                            <div className="q-metric-chip">
                              <span className="metric-chip-label">Concept Coverage:</span>
                              <span className="metric-chip-val">{q.conceptCoverage}%</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Covered & Missing Concepts */}
                      {(q.strengths.length > 0 || q.missingConcepts.length > 0) && (
                        <div className="q-concepts-grid">
                          {q.strengths.length > 0 && (
                            <div className="concepts-column concepts-covered">
                              <span className="concepts-header"><Check size={12} /> Concepts Demonstrated:</span>
                              <div className="concepts-chips-wrap">
                                {q.strengths.map((c, i) => (
                                  <span key={i} className="concept-chip chip-success">{c}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {q.missingConcepts.length > 0 && (
                            <div className="concepts-column concepts-missing">
                              <span className="concepts-header"><AlertCircle size={12} /> Concepts to Reinforce:</span>
                              <div className="concepts-chips-wrap">
                                {q.missingConcepts.map((c, i) => (
                                  <span key={i} className="concept-chip chip-warning">{c}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* STAR Behavioral Breakdown if present */}
                      {q.starAnalysis && (
                        <div className="q-star-row">
                          <span className="star-row-label">STAR Answer Structure:</span>
                          <div className="star-badges-group">
                            <StarPill label="Situation (S)" component={q.starAnalysis.situation} />
                            <StarPill label="Task (T)" component={q.starAnalysis.task} />
                            <StarPill label="Action (A)" component={q.starAnalysis.action} />
                            <StarPill label="Result (R)" component={q.starAnalysis.result} />
                          </div>
                        </div>
                      )}

                      {/* Qualitative Feedback */}
                      {q.feedback && (
                        <div className="q-feedback-block">
                          <span className="feedback-label">Evaluator Feedback:</span>
                          <p className="feedback-text">{q.feedback}</p>
                        </div>
                      )}

                      {/* Improvement Suggestion */}
                      {q.improvementSuggestion && (
                        <div className="q-improvement-tip">
                          <Sparkles size={13} className="tip-icon" />
                          <span><strong>Key Takeaway:</strong> {q.improvementSuggestion}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
