import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bot,
  X,
  Send,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  Upload,
  BookOpen,
  Compass,
  ArrowRight,
  Code2,
  Target,
  Zap,
} from 'lucide-react'
import { useAuthApi } from '../../services/api'
import './AICoachDrawer.css'

export default function AICoachDrawer({
  isOpen,
  onClose,
  initialSourceInterviewId = null,
  initialTopic = null,
}) {
  const {
    authApi,
    getCoachProfile,
    getCoachProgress,
    createCoachSession,
    getCoachSession,
    sendCoachMessage,
    triggerCoachAction,
  } = useAuthApi()

  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [profile, setProfile] = useState(null)
  const [progress, setProgress] = useState([])
  const [hasResume, setHasResume] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [error, setError] = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const activeInterviewRef = useRef(null)

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, messages, sending])

  // Initialize or resume coach session
  const initCoach = useCallback(
    async (forceNew = false) => {
      setLoading(true)
      setError(null)
      try {
        // 1. Fetch Profile & Progress
        const [profileRes, progressRes] = await Promise.all([
          getCoachProfile().catch(() => ({ data: { hasResume: false } })),
          getCoachProgress().catch(() => ({ data: { progress: [] } })),
        ])

        setProfile(profileRes.data?.profile || null)
        setHasResume(Boolean(profileRes.data?.hasResume))
        setProgress(progressRes.data?.progress || [])

        // 2. Determine session strategy
        const isResultsContext = Boolean(initialSourceInterviewId)

        // Check if there is a cached active session unless forcing new or switching interview context
        const cachedSessionId = !forceNew && !isResultsContext ? localStorage.getItem('interviewx_coach_session_id') : null

        if (cachedSessionId && !forceNew) {
          try {
            const existingRes = await getCoachSession(cachedSessionId)
            if (existingRes.data?.session) {
              setSession(existingRes.data.session)
              setMessages(existingRes.data.messages || [])
              setLoading(false)
              return
            }
          } catch {
            localStorage.removeItem('interviewx_coach_session_id')
          }
        }

        // Create new session with appropriate context
        const createPayload = {
          contextType: isResultsContext ? 'results' : 'dashboard',
          sourceInterviewId: initialSourceInterviewId || null,
          topic: initialTopic || null,
        }

        const newSessionRes = await createCoachSession(createPayload)
        const createdSession = newSessionRes.data?.session
        const initialMessages = newSessionRes.data?.messages || []

        setSession(createdSession)
        setMessages(initialMessages)

        if (createdSession?.id && !isResultsContext) {
          localStorage.setItem('interviewx_coach_session_id', createdSession.id)
        }
      } catch (err) {
        console.error('[AICoachDrawer] Initialization error:', err)
        setError('Could not connect to the AI Training Coach. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    [
      getCoachProfile,
      getCoachProgress,
      getCoachSession,
      createCoachSession,
      initialSourceInterviewId,
      initialTopic,
    ]
  )

  // Trigger load when opened or when initialSourceInterviewId changes
  useEffect(() => {
    if (!isOpen) return

    // If opening with a new interview context, re-initialize
    if (initialSourceInterviewId && activeInterviewRef.current !== initialSourceInterviewId) {
      activeInterviewRef.current = initialSourceInterviewId
      initCoach(true)
    } else if (!session && !loading) {
      initCoach(false)
    }
  }, [isOpen, initialSourceInterviewId, session, loading, initCoach])

  // Handle sending a candidate message
  const handleSendMessage = async (e) => {
    e?.preventDefault()
    if (!inputValue.trim() || sending || !session?.id) return

    const userText = inputValue.trim()
    setInputValue('')
    setSending(true)
    setError(null)

    // Optimistic user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userText,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const res = await sendCoachMessage(session.id, userText)
      const { assistantMessage, session: updatedSession } = res.data

      // Replace optimistic or append
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantMessage])

      if (updatedSession) {
        setSession((prev) => ({ ...prev, ...updatedSession }))
      }

      // Refresh progress in background
      getCoachProgress()
        .then((pRes) => setProgress(pRes.data?.progress || []))
        .catch(() => {})
    } catch (err) {
      console.error('[AICoachDrawer] Send error:', err)
      setError(err.message || 'Failed to send answer. Please retry.')
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  // Handle quick actions
  const handleQuickAction = async (actionKey) => {
    if (sending || !session?.id) return
    setSending(true)
    setError(null)

    try {
      const res = await triggerCoachAction(session.id, actionKey)
      const { assistantMessage, session: updatedSession } = res.data

      if (assistantMessage) {
        setMessages((prev) => [...prev, assistantMessage])
      }
      if (updatedSession) {
        setSession((prev) => ({ ...prev, ...updatedSession }))
      }
    } catch (err) {
      console.error('[AICoachDrawer] Quick action error:', err)
      setError('Could not process quick action. Please try again.')
    } finally {
      setSending(false)
    }
  }

  // Handle resume upload directly inside coach if missing
  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingResume(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('resume', file)

      const uploadRes = await authApi.post('/api/resumes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const resumeId = uploadRes.data?.resume?.id
      if (resumeId) {
        // Trigger parsing & analysis
        await authApi.post(`/api/resumes/${resumeId}/analyze`)
        setHasResume(true)

        // Inform coach session
        await handleQuickAction('train_me')
      }
    } catch (err) {
      console.error('[AICoachDrawer] Resume upload error:', err)
      setError('Failed to upload and analyze resume. Please try a valid PDF or DOCX file.')
    } finally {
      setUploadingResume(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Reset to new session
  const handleResetSession = () => {
    if (window.confirm('Start a fresh AI training session?')) {
      localStorage.removeItem('interviewx_coach_session_id')
      initCoach(true)
    }
  }

  if (!isOpen) return null

  // Determine difficulty badge color
  const difficultyLevel = session?.difficulty || profile?.currentDifficulty || 'Intermediate'
  const difficultyClass =
    difficultyLevel === 'Interview-level'
      ? 'diff-interview'
      : difficultyLevel === 'Advanced'
      ? 'diff-adv'
      : difficultyLevel === 'Intermediate'
      ? 'diff-med'
      : 'diff-beg'

  return (
    <div className="coach-drawer-overlay" onClick={onClose}>
      <div
        className="coach-drawer glass-card animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="InterviewX AI Training Coach"
      >
        {/* ── 1. DRAWER TOP BAR ────────────────────────────────────────── */}
        <div className="coach-top-bar">
          <div className="coach-header-left">
            <div className="coach-avatar-glow">
              <Bot size={20} className="coach-avatar-icon" />
            </div>
            <div>
              <div className="coach-title-row">
                <h3 className="coach-title">InterviewX AI Coach</h3>
                <span className={`coach-diff-pill ${difficultyClass}`}>{difficultyLevel}</span>
              </div>
              <p className="coach-subtitle">
                {session?.contextType === 'results' ? (
                  <span className="ctx-badge">
                    <Target size={11} /> Results Deep-Dive: {session.topic}
                  </span>
                ) : (
                  <span className="ctx-badge">
                    <Compass size={11} /> {session?.topic || 'Interactive Training'}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="coach-header-actions">
            <button
              type="button"
              className="btn-coach-icon"
              onClick={handleResetSession}
              title="Start fresh training session"
              disabled={loading || sending}
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              className="btn-coach-icon"
              onClick={onClose}
              title="Close coach"
              aria-label="Close coach"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── 2. REAL PROGRESS STRIP (EVIDENCE-BASED) ──────────────────── */}
        {progress.length > 0 && (
          <div className="coach-progress-strip" aria-label="Skill Mastery Trends">
            <div className="progress-strip-header">
              <TrendingUp size={12} className="progress-icon" />
              <span>Observed Mastery Trends:</span>
            </div>
            <div className="progress-pills-scroll">
              {progress.slice(0, 4).map((item, idx) => (
                <div key={idx} className="progress-item-pill">
                  <span className="pill-topic">{item.topic}</span>
                  <span className="pill-score">
                    {item.initialScore != null && item.initialScore !== item.score ? (
                      <>
                        <span className="score-before">{item.initialScore}%</span>
                        <ArrowRight size={10} className="score-arrow" />
                      </>
                    ) : null}
                    <strong>{item.score}%</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 3. CHAT MESSAGE STREAM ──────────────────────────────────── */}
        <div className="coach-message-stream">
          {loading ? (
            <div className="coach-loading-wrap">
              <div className="loading-spinner-sm" />
              <p>Initializing your personalized training context...</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isAssistant = msg.role === 'assistant'
                const meta = msg.metadata || {}

                return (
                  <div
                    key={msg.id || index}
                    className={`coach-message-row ${isAssistant ? 'from-assistant' : 'from-user'}`}
                  >
                    {isAssistant && (
                      <div className="msg-avatar">
                        <Bot size={16} />
                      </div>
                    )}

                    <div className="msg-bubble-wrap">
                      <div className={`msg-bubble ${isAssistant ? 'bubble-assistant' : 'bubble-user'}`}>
                        {/* Message body text with clean markdown linebreaks & formatting */}
                        <div className="msg-text-content">
                          {msg.content.split('\n').map((line, lIdx) => {
                            if (!line.trim()) return <div key={lIdx} className="line-break" />
                            if (line.startsWith('### ')) {
                              return (
                                <h4 key={lIdx} className="msg-heading-3">
                                  {line.replace('### ', '')}
                                </h4>
                              )
                            }
                            if (line.startsWith('**') && line.endsWith('**')) {
                              return (
                                <p key={lIdx} className="msg-bold-lead">
                                  {line.slice(2, -2)}
                                </p>
                              )
                            }
                            if (line.startsWith('• ') || line.startsWith('- ')) {
                              return (
                                <div key={lIdx} className="msg-bullet-item">
                                  <span className="bullet-dot">•</span>
                                  <span>{line.slice(2)}</span>
                                </div>
                              )
                            }
                            return <p key={lIdx}>{line}</p>
                          })}
                        </div>

                        {/* Structured Feedback Card if evaluation metadata is present */}
                        {meta.isEvaluation && (
                          <div className="msg-eval-card">
                            {meta.strengths?.length > 0 && (
                              <div className="eval-subgroup strengths-sub">
                                <div className="eval-subgroup-title">
                                  <CheckCircle2 size={13} className="eval-icon-green" />
                                  <span>Demonstrated Strengths:</span>
                                </div>
                                <ul className="eval-list">
                                  {meta.strengths.map((s, sIdx) => (
                                    <li key={sIdx}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {meta.missingConcepts?.length > 0 && (
                              <div className="eval-subgroup missing-sub">
                                <div className="eval-subgroup-title">
                                  <AlertCircle size={13} className="eval-icon-amber" />
                                  <span>Missing or Incomplete Concepts:</span>
                                </div>
                                <ul className="eval-list">
                                  {meta.missingConcepts.map((m, mIdx) => (
                                    <li key={mIdx}>{m}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {meta.hint && (
                              <div className="eval-hint-box">
                                <Lightbulb size={13} className="eval-icon-cyan" />
                                <span>
                                  <strong>Guided Hint:</strong> {meta.hint}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <span className="msg-time">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                )
              })}

              {/* Quick Actions (Rendered under initial greeting when message count is low) */}
              {messages.length <= 2 && !sending && (
                <div className="coach-quick-actions-card">
                  <span className="quick-actions-title">
                    <Sparkles size={12} /> Suggested Quick Drills:
                  </span>
                  <div className="quick-actions-grid">
                    <button
                      type="button"
                      className="btn-quick-action"
                      onClick={() => handleQuickAction('train_me')}
                    >
                      <Target size={13} />
                      <span>Train me</span>
                    </button>
                    <button
                      type="button"
                      className="btn-quick-action"
                      onClick={() => handleQuickAction('practice_questions')}
                    >
                      <BookOpen size={13} />
                      <span>Practice questions</span>
                    </button>
                    <button
                      type="button"
                      className="btn-quick-action"
                      onClick={() => handleQuickAction('weak_areas')}
                    >
                      <Zap size={13} />
                      <span>Improve weak areas</span>
                    </button>
                    <button
                      type="button"
                      className="btn-quick-action"
                      onClick={() => handleQuickAction('analyze_interviews')}
                    >
                      <TrendingUp size={13} />
                      <span>Analyze past interviews</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Resume Upload Prompt if no resume exists */}
              {!hasResume && (
                <div className="coach-resume-prompt glass-card">
                  <div className="resume-prompt-icon">
                    <Upload size={18} />
                  </div>
                  <div className="resume-prompt-body">
                    <h4>No Resume on File</h4>
                    <p>Upload your resume to calibrate active training to your verified tech stack and target role.</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      style={{ display: 'none' }}
                      onChange={handleResumeUpload}
                    />
                    <button
                      type="button"
                      className="btn-upload-resume-cta"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingResume}
                    >
                      {uploadingResume ? (
                        <>
                          <div className="loading-spinner-xs" /> Analyzing Resume...
                        </>
                      ) : (
                        <>
                          <Upload size={13} /> Upload Resume (PDF/DOCX)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Typing / Sending indicator */}
              {sending && (
                <div className="coach-message-row from-assistant">
                  <div className="msg-avatar">
                    <Bot size={16} />
                  </div>
                  <div className="msg-bubble bubble-assistant typing-bubble">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}

              {/* Error banner */}
              {error && (
                <div className="coach-error-banner">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                  <button type="button" className="btn-retry-err" onClick={() => initCoach(false)}>
                    Retry
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* ── 4. INPUT & COMPOSER BAR ──────────────────────────────────── */}
        <form className="coach-composer-form" onSubmit={handleSendMessage}>
          <div className="composer-input-wrap">
            <textarea
              ref={inputRef}
              className="composer-textarea"
              rows={2}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={
                session?.currentQuestionText
                  ? 'Type your answer or technical reasoning... (Enter to send)'
                  : 'Ask the coach, or request an interview drill...'
              }
              disabled={loading || sending}
            />
            <div className="composer-footer-row">
              <span className="composer-hint">Shift + Enter for new line</span>
              <button
                type="submit"
                className="btn-send-coach"
                disabled={!inputValue.trim() || sending || loading}
                aria-label="Send response"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
