import { useState, useEffect } from 'react'
import {
  CheckCircle2, XCircle, ChevronRight, RefreshCw, X, Sparkles,
  Target, ArrowLeft, Award, AlertCircle
} from 'lucide-react'

export default function PracticeModal({
  mode = 'topic_practice',
  skill = 'React',
  topics = [],
  interviewId = null,
  authApi,
  onClose,
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [session, setSession] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedOption, setSelectedOption] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [currentFeedback, setCurrentFeedback] = useState(null)
  const [completing, setCompleting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  // Initialize or fetch session
  const initSession = async () => {
    setLoading(true)
    setError(null)
    setCurrentFeedback(null)
    setSelectedOption(null)
    setIsCompleted(false)
    setCurrentIdx(0)

    try {
      let res
      if (mode === 'targeted_mock') {
        res = await authApi.post('/api/practice/targeted', {
          interviewId,
          weakAreas: Array.isArray(topics) && topics.length > 0 ? topics : undefined,
        })
      } else {
        res = await authApi.post('/api/practice/topic', {
          skill,
          interviewId,
          topics,
        })
      }

      const sessionData = res.data?.data?.session || res.data?.session
      if (!sessionData || !sessionData.questions || sessionData.questions.length === 0) {
        throw new Error('No practice questions could be generated. Please try again.')
      }

      setSession(sessionData)

      // Find first unanswered question if resuming
      const answeredSet = new Set((sessionData.selectedAnswers || []).map((a) => a.questionIndex))
      const firstUnanswered = sessionData.questions.findIndex((_, i) => !answeredSet.has(i))

      if (sessionData.status === 'completed') {
        setIsCompleted(true)
      } else if (firstUnanswered !== -1) {
        setCurrentIdx(firstUnanswered)
      }
    } catch (err) {
      console.error('[PracticeModal] Error loading session:', err)
      const msg = err.response?.data?.message || err.message || 'Failed to initialize practice session.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    initSession()
  }, [mode, skill, interviewId])

  // Handle single answer submission
  const handleSubmitAnswer = async () => {
    if (selectedOption === null || submitting || !session) return

    setSubmitting(true)
    try {
      const res = await authApi.post(`/api/practice/${session._id}/answer`, {
        questionIndex: currentIdx,
        selectedOption,
      })

      const feedback = res.data?.data || res.data
      setCurrentFeedback(feedback)

      // Update local session state
      setSession((prev) => {
        if (!prev) return prev
        const updatedAnswers = [
          ...(prev.selectedAnswers || []),
          {
            questionIndex: currentIdx,
            selectedOption,
            isCorrect: feedback.isCorrect,
          },
        ]
        return {
          ...prev,
          score: feedback.score ?? prev.score,
          selectedAnswers: updatedAnswers,
        }
      })
    } catch (err) {
      console.error('[PracticeModal] Error submitting answer:', err)
      alert(err.response?.data?.message || 'Failed to submit answer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle moving to next question or completing
  const handleNextQuestion = async () => {
    if (!session) return

    const nextIndex = currentIdx + 1
    if (nextIndex < session.questions.length) {
      setCurrentIdx(nextIndex)
      setSelectedOption(null)
      setCurrentFeedback(null)
    } else {
      // All questions finished -> Complete session
      setCompleting(true)
      try {
        const res = await authApi.post(`/api/practice/${session._id}/complete`)
        const data = res.data?.data || res.data
        setSession(data.session || session)
        setIsCompleted(true)
      } catch (err) {
        console.error('[PracticeModal] Error completing session:', err)
        // Even if complete endpoint fails, calculate locally
        setIsCompleted(true)
      } finally {
        setCompleting(false)
      }
    }
  }

  const currentQ = session?.questions?.[currentIdx]
  const totalQuestions = session?.questions?.length || 20
  const answeredCount = session?.selectedAnswers?.length || 0

  return (
    <div
      className="practice-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        className="practice-modal-container glass-card"
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* ==================================================================
            1. HEADER
            ================================================================== */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.2))',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              {mode === 'targeted_mock' ? <Sparkles size={20} /> : <Target size={20} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>
                  {mode === 'targeted_mock'
                    ? 'Targeted Mock Assessment'
                    : `${skill} Practice Test`}
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: mode === 'targeted_mock' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                    color: mode === 'targeted_mock' ? '#c084fc' : '#818cf8',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {mode === 'targeted_mock' ? 'Combined Weak Areas' : 'Topic Practice'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                {isCompleted
                  ? 'Assessment Complete'
                  : `Question ${currentIdx + 1} of ${totalQuestions}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Practice"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar (when not completed) */}
        {!isCompleted && !loading && !error && (
          <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.06)', width: '100%' }}>
            <div
              style={{
                height: '100%',
                width: `${((currentIdx + (currentFeedback ? 1 : 0)) / totalQuestions) * 100}%`,
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                transition: 'width 0.3s ease-in-out',
              }}
            />
          </div>
        )}

        {/* ==================================================================
            2. BODY CONTENT
            ================================================================== */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* LOADING STATE */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ margin: '0 auto 20px', display: 'flex', justifyContent: 'center' }}>
                <RefreshCw size={40} color="#818cf8" style={{ animation: 'spin 1.8s linear infinite' }} />
              </div>
              <h3 style={{ fontSize: '19px', fontWeight: 700, color: '#ffffff', margin: '0 0 8px' }}>
                {mode === 'targeted_mock'
                  ? 'Synthesizing your targeted weak-area mock test...'
                  : `Generating your ${skill} practice test...`}
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 24px', maxWidth: '420px', marginInline: 'auto', lineHeight: 1.6 }}>
                Constructing 20+ specialized MCQs across fundamentals, practical scenarios, and advanced architecture.
              </p>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', maxWidth: '280px', margin: '0 auto' }}>
                <div style={{ height: '100%', width: '65%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }} />
              </div>
            </div>
          )}

          {/* ERROR STATE */}
          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}>
                <AlertCircle size={44} color="#f87171" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: '0 0 8px' }}>
                Unable to load practice questions
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 24px', maxWidth: '460px', marginInline: 'auto', lineHeight: 1.5 }}>
                {error}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={initSession}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} /> Retry
                </button>
                <button
                  onClick={onClose}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowLeft size={14} /> Back to Results
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE TEST STATE */}
          {!loading && !error && !isCompleted && currentQ && (
            <div>
              {/* Question metadata badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {currentQ.topic && (
                    <span style={{ fontSize: '11px', color: '#818cf8', background: 'rgba(99, 102, 241, 0.12)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                      {currentQ.topic}
                    </span>
                  )}
                  {currentQ.difficulty && (
                    <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'capitalize' }}>
                      · {currentQ.difficulty}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  Score: {session.score || 0} / {answeredCount}
                </span>
              </div>

              {/* Question Text */}
              <h2
                style={{
                  fontSize: '17px',
                  fontWeight: 600,
                  color: '#ffffff',
                  lineHeight: 1.5,
                  margin: '0 0 22px',
                  wordBreak: 'break-word',
                }}
              >
                {currentQ.question}
              </h2>

              {/* Options List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {currentQ.options.map((opt, optIdx) => {
                  const isSelected = selectedOption === optIdx
                  const isSubmitted = currentFeedback !== null
                  const isCorrect = currentFeedback?.correctAnswer === optIdx
                  const isUserSelection = currentFeedback?.userAnswer === optIdx

                  let borderColor = 'rgba(255, 255, 255, 0.1)'
                  let bgColor = 'rgba(255, 255, 255, 0.03)'
                  let textColor = '#e2e8f0'

                  if (isSubmitted) {
                    if (isCorrect) {
                      borderColor = '#10b981'
                      bgColor = 'rgba(16, 185, 129, 0.15)'
                      textColor = '#a7f3d0'
                    } else if (isUserSelection && !currentFeedback.isCorrect) {
                      borderColor = '#ef4444'
                      bgColor = 'rgba(239, 68, 68, 0.15)'
                      textColor = '#fca5a5'
                    }
                  } else if (isSelected) {
                    borderColor = '#6366f1'
                    bgColor = 'rgba(99, 102, 241, 0.15)'
                    textColor = '#ffffff'
                  }

                  const optionLetters = ['A', 'B', 'C', 'D']

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={isSubmitted || submitting}
                      onClick={() => setSelectedOption(optIdx)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: `1.5px solid ${borderColor}`,
                        backgroundColor: bgColor,
                        color: textColor,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        cursor: isSubmitted ? 'default' : 'pointer',
                        textAlign: 'left',
                        fontSize: '14px',
                        lineHeight: 1.45,
                        transition: 'all 0.15s ease',
                        width: '100%',
                        wordBreak: 'break-word',
                      }}
                    >
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                          flexShrink: 0,
                          backgroundColor: isSubmitted
                            ? isCorrect
                              ? '#10b981'
                              : isUserSelection
                              ? '#ef4444'
                              : 'rgba(255, 255, 255, 0.08)'
                            : isSelected
                            ? '#6366f1'
                            : 'rgba(255, 255, 255, 0.08)',
                          color: '#ffffff',
                        }}
                      >
                        {optionLetters[optIdx]}
                      </span>
                      <span style={{ flex: 1 }}>{opt}</span>
                    </button>
                  )
                })}
              </div>

              {/* POST-SUBMISSION FEEDBACK */}
              {currentFeedback && (
                <div
                  style={{
                    backgroundColor: currentFeedback.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${currentFeedback.isCorrect ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '20px',
                    animation: 'fadeIn 0.2s ease-in',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {currentFeedback.isCorrect ? (
                      <>
                        <CheckCircle2 size={18} color="#10b981" />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>
                          ✓ Correct
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle size={18} color="#ef4444" />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>
                          ✗ Incorrect
                        </span>
                      </>
                    )}
                  </div>

                  <div style={{ fontSize: '13px', color: '#e2e8f0', marginBottom: '6px' }}>
                    <strong style={{ color: '#ffffff' }}>Correct Answer: </strong>
                    <span style={{ color: '#34d399' }}>
                      {currentQ.options[currentFeedback.correctAnswer]}
                    </span>
                  </div>

                  {currentFeedback.explanation && (
                    <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.55 }}>
                      <strong style={{ color: '#cbd5e1' }}>Explanation: </strong>
                      {currentFeedback.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==================================================================
              3. PRACTICE COMPLETE / RESULT SCREEN
              ================================================================== */}
          {isCompleted && (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(16, 185, 129, 0.2))',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#10b981',
                }}
              >
                <Award size={32} />
              </div>

              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px' }}>
                {session?.targetSkill} Complete
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 24px' }}>
                You have finished all {session?.totalQuestions || 20} mock practice questions.
              </p>

              {/* Score summary cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '12px',
                  maxWidth: '520px',
                  margin: '0 auto 28px',
                }}
              >
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px 10px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#818cf8' }}>
                    {session?.percentage || 0}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Score</div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '14px 10px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#34d399' }}>
                    {session?.score || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#a7f3d0' }}>Correct</div>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '14px 10px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#f87171' }}>
                    {Math.max(0, (session?.totalQuestions || 20) - (session?.score || 0))}
                  </div>
                  <div style={{ fontSize: '12px', color: '#fca5a5' }}>Incorrect</div>
                </div>
              </div>

              {/* Weak Topics / Focus Areas */}
              {session?.weakTopics && session.weakTopics.length > 0 && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '20px',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <AlertCircle size={16} color="#f87171" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Recommended Focus Areas
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {session.weakTopics.map((topic, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '12px',
                          color: '#f87171',
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        • {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Strong Topics */}
              {session?.strongTopics && session.strongTopics.length > 0 && (
                <div
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '28px',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <CheckCircle2 size={16} color="#34d399" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Concepts Answered Correctly
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {session.strongTopics.map((topic, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '12px',
                          color: '#34d399',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                        }}
                      >
                        ✓ {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={initSession}
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                  }}
                >
                  <RefreshCw size={15} /> Retake Practice
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                  }}
                >
                  <ArrowLeft size={15} /> Back to Results
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================
            4. FOOTER CONTROLS (Active Test)
            ================================================================== */}
        {!loading && !error && !isCompleted && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
            }}
          >
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              {currentFeedback
                ? 'Answer evaluated. Continue when ready.'
                : 'Select one answer and submit.'}
            </span>

            <div style={{ display: 'flex', gap: '10px' }}>
              {!currentFeedback ? (
                <button
                  type="button"
                  disabled={selectedOption === null || submitting}
                  onClick={handleSubmitAnswer}
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 18px',
                    fontSize: '13px',
                    opacity: selectedOption === null || submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...
                    </>
                  ) : (
                    'Submit Answer'
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={completing}
                  onClick={handleNextQuestion}
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 18px',
                    fontSize: '13px',
                  }}
                >
                  {currentIdx + 1 < totalQuestions ? (
                    <>
                      Next Question <ChevronRight size={15} />
                    </>
                  ) : completing ? (
                    <>
                      <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Finalizing...
                    </>
                  ) : (
                    'Finish Assessment'
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
