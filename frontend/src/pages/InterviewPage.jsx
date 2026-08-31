import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthApi } from '../services/api'
import {
  Brain, Clock, Tag, BarChart2, AlertCircle,
  ChevronRight, CheckCircle, Info,
  TrendingUp, Zap, BookOpen, Layers, Target, ShieldCheck,
  SkipForward, Code2, AlertTriangle, Send, Loader2
} from 'lucide-react'
import useSpeechRecognition from '../hooks/useSpeechRecognition'
import AnswerComposer from '../components/AnswerComposer'
import CodingEditor from '../components/CodingEditor'
import VideoRecorder from '../components/VideoRecorder'
import AudioRecorder from '../components/AudioRecorder'
import './InterviewPage.css'

const CATEGORY_COLORS = {
  technical: 'badge-purple',
  coding: 'badge-purple',
  behavioral: 'badge-cyan',
  hr: 'badge-green',
  project: 'badge-yellow',
  conceptual: 'badge-purple',
  situational: 'badge-cyan',
  skill_gap: 'badge-red',
  experience: 'badge-green',
  follow_up: 'badge-yellow',
}

const DIFFICULTY_COLORS = {
  easy: 'badge-green',
  medium: 'badge-yellow',
  hard: 'badge-red',
}

const TYPE_ICONS = {
  technical: '⚙️',
  coding: '💻',
  project: '🏗️',
  experience: '💼',
  behavioral: '🤝',
  job_specific: '🎯',
  skill_gap: '📊',
  follow_up: '↩️',
}

// Helper to calculate exact remaining seconds based on interview started timestamp
const calculateRemainingSeconds = (startedAt, durationMinutes = 30) => {
  if (!startedAt) return durationMinutes * 60
  const startTime = new Date(startedAt).getTime()
  const endTime = startTime + durationMinutes * 60 * 1000
  const remaining = Math.floor((endTime - Date.now()) / 1000)
  return Math.max(0, remaining)
}

export default function InterviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { authApi, isLoaded, isSignedIn } = useAuthApi()

  // Interview core state
  const [interview, setInterview] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [answer, setAnswer] = useState('')
  const [mode, setMode] = useState('audio') // 'audio' | 'video' | 'text'
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [error, setError] = useState(null)
  const [lastEval, setLastEval] = useState(null)
  const [isComplete, setIsComplete] = useState(false)

  // Coding challenge state
  const [codeValue, setCodeValue] = useState('')
  const [codingLanguage, setCodingLanguage] = useState('javascript')
  const [codingExplanation, setCodingExplanation] = useState('')

  // Media Blobs
  const [audioBlob, setAudioBlob] = useState(null)
  const [videoBlob, setVideoBlob] = useState(null)
  const [isMediaRecording, setIsMediaRecording] = useState(false)
  const [mediaSubmitting, setMediaSubmitting] = useState(false)

  // Persistent countdown timer state
  const [remainingSeconds, setRemainingSeconds] = useState(1800)
  const [questionTimer, setQuestionTimer] = useState(0)
  const [timeoutNotice, setTimeoutNotice] = useState(false)

  const timerRef = useRef(null)
  const startedRef = useRef(null)
  const hasAutoCompletedRef = useRef(false)
  const videoRecorderRef = useRef(null)
  const audioRecorderRef = useRef(null)

  // Speech-to-Text Integration
  // When a final speech segment is confirmed, append non-destructively
  const handleFinalTranscript = useCallback((phrase) => {
    if (currentQuestion?.type === 'coding') {
      setCodingExplanation((prev) => {
        const trimmed = prev.trimEnd()
        if (!trimmed) return phrase
        return `${trimmed} ${phrase}`
      })
    } else {
      setAnswer((prev) => {
        const trimmed = prev.trimEnd()
        if (!trimmed) return phrase
        return `${trimmed} ${phrase}`
      })
    }
  }, [currentQuestion?.type])

  const {
    isSupported: isSpeechSupported,
    isListening,
    interimTranscript,
    status: speechStatus,
    error: speechError,
    startListening,
    stopListening,
    reset: resetSpeech,
  } = useSpeechRecognition({ onFinalTranscript: handleFinalTranscript })

  // Initialize Interview Session
  useEffect(() => {
    if (!isLoaded || !id) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    if (startedRef.current === id) return
    startedRef.current = id

    const init = async () => {
      setLoading(true)
      try {
        const res = await authApi.post(`/api/interviews/${id}/start`)
        const data = res.data
        setInterview(data.interview)
        setCurrentQuestion(data.currentQuestion)
        setIsComplete(data.interview.status === 'completed')

        // Initialize coding fields if first question is coding
        if (data.currentQuestion?.type === 'coding') {
          setCodeValue(data.currentQuestion.starterCode || '')
          setCodingLanguage(data.currentQuestion.language || 'javascript')
          setCodingExplanation('')
        }

        // Calculate exact remaining time from backend startedAt & durationMinutes
        const rem = calculateRemainingSeconds(data.interview.startedAt, data.interview.durationMinutes)
        setRemainingSeconds(rem)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id, isLoaded, isSignedIn])

  // Real-time Countdown Timer (persists on refresh, never resets on re-render)
  useEffect(() => {
    if (isComplete || loading || !interview?.startedAt) return

    const tick = () => {
      setQuestionTimer((t) => t + 1)
      const rem = calculateRemainingSeconds(interview.startedAt, interview.durationMinutes)
      setRemainingSeconds(rem)

      // When timer hits 00:00, execute timeout auto-completion exactly once
      if (rem <= 0 && !hasAutoCompletedRef.current) {
        hasAutoCompletedRef.current = true
        clearInterval(timerRef.current)
        handleTimeoutAutoEnd()
      }
    }

    // Initial check
    tick()
    timerRef.current = setInterval(tick, 1000)

    return () => clearInterval(timerRef.current)
  }, [isComplete, loading, interview?.startedAt, interview?.durationMinutes])

  // Automatic interview completion when timer hits 00:00
  const handleTimeoutAutoEnd = async () => {
    setTimeoutNotice(true)
    // 1. Stop speech recognition and media capture
    if (isListening) stopListening()
    setIsMediaRecording(false)

    try {
      // 2. Mark interview completed with time_expired reason
      await authApi.post(`/api/interviews/${id}/complete`, {
        completionReason: 'time_expired',
      })
      // 3. Navigate cleanly to results page
      setTimeout(() => {
        navigate(`/interview/${id}/results`)
      }, 1500)
    } catch (err) {
      console.warn('[Interview] Timeout complete notice:', err.message)
      navigate(`/interview/${id}/results`)
    }
  }

  // Format MM:SS with leading zeroes
  const formatCountdown = (secs) => {
    if (secs <= 0) return '00:00'
    const mins = Math.floor(secs / 60)
    const s = secs % 60
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Handle Mode Selection
  const handleModeChange = (newMode) => {
    if (newMode === mode) return
    if (isListening) {
      stopListening()
      setIsMediaRecording(false)
    }
    setMode(newMode)
  }

  // Start / Stop Dictation
  const handleStartSpeaking = () => {
    startListening()
    setIsMediaRecording(true)
  }

  const handleStopSpeaking = () => {
    stopListening()
    setIsMediaRecording(false)
  }

  // Clear Answer
  const handleClearAnswer = () => {
    if (isListening) {
      stopListening()
      setIsMediaRecording(false)
    }
    setAnswer('')
    setCodeValue('')
    setCodingExplanation('')
    setAudioBlob(null)
    setVideoBlob(null)
    resetSpeech()
  }

  // Media upload background synchronization
  const submitMedia = async (responseId, questionId, curAudioBlob, curVideoBlob) => {
    const promises = []

    if (curAudioBlob) {
      const formData = new FormData()
      formData.append('audio', curAudioBlob, 'recording.webm')
      formData.append('responseId', responseId)
      formData.append('questionId', questionId)
      promises.push(
        authApi.post(`/api/interviews/${id}/audio-response`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }).catch((e) => console.warn('[Interview] Audio upload notice:', e.message))
      )
    }

    if (curVideoBlob) {
      const formData = new FormData()
      formData.append('video', curVideoBlob, 'recording.webm')
      formData.append('responseId', responseId)
      formData.append('questionId', questionId)
      promises.push(
        authApi.post(`/api/interviews/${id}/video-response`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }).catch((e) => console.warn('[Interview] Video upload notice:', e.message))
      )
    }

    if (promises.length > 0) {
      setMediaSubmitting(true)
      await Promise.all(promises).finally(() => setMediaSubmitting(false))
    }
  }

  // Submit Answer Flow (handles text, speech-to-text, and coding)
  const handleSubmit = async () => {
    if (!currentQuestion) return

    // 1. Stop speech recognition and media recording
    if (isListening) stopListening()
    setIsMediaRecording(false)

    const isCoding = currentQuestion.type === 'coding'
    const textToSubmit = isCoding
      ? (codingExplanation.trim() || codeValue.trim())
      : answer.trim()

    if (!textToSubmit && !codeValue.trim()) return

    setSubmitting(true)
    setError(null)
    setQuestionTimer(0)

    try {
      const payload = {
        questionId: currentQuestion.id,
        answerText: textToSubmit,
        responseType: isCoding ? 'coding' : 'text',
        code: isCoding ? codeValue : null,
        language: isCoding ? codingLanguage : null,
      }

      // 2. Submit response to backend
      const res = await authApi.post(`/api/interviews/${id}/responses`, payload)

      const responseId = res.data.response?.id
      const questionId = currentQuestion.id
      const currentAudio = audioBlob
      const currentVideo = videoBlob

      // 3. Concurrently submit supporting audio/video modalities
      submitMedia(responseId, questionId, currentAudio, currentVideo)

      // 4. Update UI state & next question
      setLastEval(res.data.response)
      setAnswer('')
      setCodeValue('')
      setCodingExplanation('')
      setAudioBlob(null)
      setVideoBlob(null)
      resetSpeech()
      setInterview(res.data.interview)

      if (res.data.interview.isComplete) {
        setIsComplete(true)
        setCurrentQuestion(null)
      } else {
        const nextQ = res.data.nextQuestion
        setCurrentQuestion(nextQ)
        if (nextQ?.type === 'coding') {
          setCodeValue(nextQ.starterCode || '')
          setCodingLanguage(nextQ.language || 'javascript')
          setCodingExplanation('')
        }
      }
    } catch (err) {
      setError(err.message || 'Could not submit answer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Skip Question Flow
  const handleInitiateSkip = () => {
    if (submitting || skipping) return
    const hasDraftAnswer = (answer && answer.trim().length > 0) || (codeValue && codeValue.trim().length > 0)
    if (hasDraftAnswer || isListening) {
      setShowSkipConfirm(true)
    } else {
      executeSkip()
    }
  }

  const executeSkip = async () => {
    if (!currentQuestion || skipping) return
    setShowSkipConfirm(false)
    setSkipping(true)
    setError(null)

    // Stop active dictation and media capture
    if (isListening) stopListening()
    setIsMediaRecording(false)

    try {
      const res = await authApi.post(`/api/interviews/${id}/questions/${currentQuestion.id}/skip`, {
        reason: 'candidate_skipped',
      })

      // Reset composer fields
      setAnswer('')
      setCodeValue('')
      setCodingExplanation('')
      setAudioBlob(null)
      setVideoBlob(null)
      resetSpeech()
      setInterview(res.data.interview)

      if (res.data.interview.isComplete) {
        setIsComplete(true)
        setCurrentQuestion(null)
        navigate(`/interview/${id}/results`)
      } else {
        const nextQ = res.data.nextQuestion
        setCurrentQuestion(nextQ)
        if (nextQ?.type === 'coding') {
          setCodeValue(nextQ.starterCode || '')
          setCodingLanguage(nextQ.language || 'javascript')
          setCodingExplanation('')
        }
      }
    } catch (err) {
      setError(err.message || 'Could not skip question. Please try again.')
    } finally {
      setSkipping(false)
    }
  }

  // End Interview Flow
  const handleEndInterview = async (auto = false) => {
    if (!auto && !window.confirm('End interview now? This will complete your interview session and generate your evaluation.')) {
      return
    }
    try {
      await authApi.post(`/api/interviews/${id}/complete`, {
        completionReason: 'user_ended',
      })
      navigate(`/interview/${id}/results`)
    } catch (err) {
      setError(err.message)
    }
  }

  // Progress calculations
  const totalQ = interview?.totalQuestions || 10
  const currentQIndex = interview?.currentQuestionIndex ?? 0
  const skippedCount = interview?.skippedQuestionsCount || 0
  const answeredCount = Math.max(0, currentQIndex - skippedCount)
  const progressPercent = Math.min(100, Math.round((currentQIndex / totalQ) * 100))

  // Timer states
  const isUrgentTime = remainingSeconds <= 60 && remainingSeconds > 0
  const isWarningTime = remainingSeconds <= 300 && remainingSeconds > 60
  const isTimeExpired = remainingSeconds === 0

  if (loading) {
    return (
      <div className="interview-loading animate-fade-in">
        <div className="loading-spinner-box">
          <Brain size={36} className="brand-pulse-icon" />
          <div className="custom-loader" />
        </div>
        <h2 className="loading-title">Preparing Your Interview Session</h2>
        <p className="loading-subtitle">Configuring adaptive evaluation parameters...</p>
      </div>
    )
  }

  if (isComplete) {
    return (
      <div className="interview-complete animate-fade-in">
        <div className="complete-card glass-card">
          <div className="complete-badge-icon">
            <CheckCircle size={42} className="complete-success-icon" />
          </div>
          <h1 className="complete-title">Interview Completed</h1>
          <p className="complete-subtitle">
            You successfully completed all {interview?.totalQuestions ?? currentQIndex} questions in this interview.
            {mediaSubmitting && ' Final media analysis is finalizing...'}
          </p>
          {mediaSubmitting && (
            <div className="media-uploading-tag">
              <div className="spinner-mini" /> Finalizing audio & video processing...
            </div>
          )}
          <div className="complete-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => navigate(`/interview/${id}/results`)}
            >
              <span>View Comprehensive Results</span>
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/dashboard')}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="interview-page">
      {/* Background Audio Recorder for Voice Mode (silent capture) */}
      <AudioRecorder
        ref={audioRecorderRef}
        isRecording={isMediaRecording && mode === 'audio'}
        onRecordingComplete={(blob) => setAudioBlob(blob)}
        disabled={submitting || skipping}
      />

      {/* Timeout notification banner */}
      {timeoutNotice && (
        <div className="timeout-notice-banner animate-fade-in">
          <AlertTriangle size={18} />
          <span>Time is up! Your interview has ended. Finalizing evaluation results...</span>
        </div>
      )}

      {/* Skip confirmation modal */}
      {showSkipConfirm && (
        <div className="modal-backdrop animate-fade-in">
          <div className="skip-confirm-modal glass-card animate-scale-up">
            <div className="skip-modal-icon">
              <AlertCircle size={32} color="#f59e0b" />
            </div>
            <h3 className="skip-modal-title">Skip this question?</h3>
            <p className="skip-modal-text">
              Your in-progress answer will not be submitted. This question will be marked as skipped and will not negatively impact your evaluation score.
            </p>
            <div className="skip-modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowSkipConfirm(false)}
                disabled={skipping}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger-skip"
                onClick={executeSkip}
                disabled={skipping}
              >
                {skipping ? 'Skipping...' : 'Yes, Skip Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Interview Top Bar */}
      <header className="interview-topbar">
        <div className="interview-topbar-inner">
          <div className="topbar-left">
            <div className="interview-brand" onClick={() => navigate('/dashboard')} role="button" tabIndex={0}>
              <Brain size={20} className="brand-icon" />
              <span className="brand-name">InterviewX</span>
            </div>

            <div className="interview-meta-pills">
              <span className="pill pill-type">
                {interview?.interviewType ? `${interview.interviewType.charAt(0).toUpperCase() + interview.interviewType.slice(1)} Interview` : 'Technical Interview'}
              </span>
              <span className="pill pill-adaptive">
                <SparklesIcon size={12} />
                <span>Adaptive Interview</span>
              </span>
            </div>
          </div>

          <div className="topbar-right">
            <div className="question-count-badge">
              <span className="count-label">Question</span>
              <span className="count-value">{Math.min(currentQIndex + 1, totalQ)} / {totalQ}</span>
            </div>

            {/* Persistent Countdown Timer */}
            <div
              className={`timer-display ${isTimeExpired ? 'timer-expired' : isUrgentTime ? 'timer-urgent' : isWarningTime ? 'timer-warning' : ''}`}
              title={`Interview countdown (${interview?.durationMinutes || 30} mins session)`}
            >
              <Clock size={15} className="timer-icon" />
              <div className="timer-content">
                <span className="timer-label">SESSION TIME</span>
                <span className="timer-digits">
                  {isTimeExpired ? "TIME'S UP" : formatCountdown(remainingSeconds)}
                </span>
              </div>
              {isUrgentTime && <span className="urgent-indicator">●</span>}
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-end-session"
              onClick={() => handleEndInterview(false)}
              title="End interview and view results"
            >
              End Session
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="topbar-progress-track">
          <div
            className="topbar-progress-fill"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin="0"
            aria-valuemax="100"
          />
        </div>
      </header>

      {/* Main 2-Column Responsive Layout */}
      <main className="interview-main-layout">
        {/* Left Column: Question & Composer / Code Editor */}
        <section className="interview-main-column">
          {/* Active Question Card */}
          {currentQuestion ? (
            <article className="question-card glass-card animate-fade-in" key={currentQuestion.id}>
              <div className="question-card-header">
                <div className="question-pill-group">
                  <span className="question-num-tag">
                    {TYPE_ICONS[currentQuestion.type] || '❓'} Question {currentQIndex + 1}
                  </span>
                  <span className={`badge ${CATEGORY_COLORS[currentQuestion.category] || 'badge-purple'}`}>
                    <Tag size={11} />
                    <span style={{ textTransform: 'capitalize' }}>
                      {currentQuestion.type === 'coding' ? 'Coding Challenge' : currentQuestion.category}
                    </span>
                  </span>
                  <span className={`badge ${DIFFICULTY_COLORS[currentQuestion.difficulty]}`}>
                    <span style={{ textTransform: 'capitalize' }}>{currentQuestion.difficulty}</span>
                  </span>
                  {currentQuestion.targetSkill && currentQuestion.targetSkill !== 'general' && (
                    <span className="badge badge-gray">
                      <Target size={11} /> {currentQuestion.targetSkill}
                    </span>
                  )}
                </div>
              </div>

              {/* Context Note */}
              {currentQuestion.contextNote && (
                <div className="question-context-box">
                  <Info size={13} className="context-icon" />
                  <span>{currentQuestion.contextNote}</span>
                </div>
              )}

              {/* Main Question Text */}
              <h2 className="question-text-content">
                {currentQuestion.text}
              </h2>

              {/* Question Assessment Source */}
              {currentQuestion.source && currentQuestion.source !== 'static_bank' && (
                <div className="question-source-indicator">
                  {currentQuestion.source === 'resume' && <><BookOpen size={12} /> Assessed from your resume</>}
                  {currentQuestion.source === 'job_description' && <><Zap size={12} /> Tailored to job description</>}
                  {currentQuestion.source === 'skill_gap' && <><BarChart2 size={12} /> Targeted skill gap evaluation</>}
                  {currentQuestion.source === 'experience' && <><TrendingUp size={12} /> Project experience assessment</>}
                  {currentQuestion.source === 'behavioral' && <><CheckCircle size={12} /> Behavioral competency</>}
                </div>
              )}
            </article>
          ) : (
            <div className="question-card glass-card">
              <p className="loading-text">Loading question...</p>
            </div>
          )}

          {/* Conditional Rendering: Coding Challenge Editor vs Standard Answer Composer */}
          {currentQuestion?.type === 'coding' ? (
            <div className="coding-challenge-container animate-fade-in">
              <CodingEditor
                starterCode={currentQuestion.starterCode || ''}
                defaultLanguage={currentQuestion.language || 'javascript'}
                codeValue={codeValue}
                onCodeChange={setCodeValue}
                explanationValue={codingExplanation}
                onExplanationChange={setCodingExplanation}
                onLanguageChange={setCodingLanguage}
                disabled={submitting || skipping || isTimeExpired}
              />

              {/* Action Bar for Coding Challenge */}
              <div className="coding-action-bar glass-card">
                <div className="coding-action-left">
                  <span className="shortcut-hint">
                    Write solution in editor · You can also speak your explanation in Voice/Video mode
                  </span>
                </div>

                <div className="coding-action-right">
                  <button
                    type="button"
                    className="btn btn-secondary btn-skip-question"
                    onClick={handleInitiateSkip}
                    disabled={submitting || skipping || isTimeExpired}
                    title="Skip this coding challenge"
                    id="skip-coding-btn"
                  >
                    {skipping ? (
                      <>
                        <Loader2 size={15} className="spin" />
                        <span>Skipping...</span>
                      </>
                    ) : (
                      <>
                        <SkipForward size={15} />
                        <span>Skip Question</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary btn-submit-answer"
                    onClick={handleSubmit}
                    disabled={(!codeValue.trim() && !codingExplanation.trim()) || submitting || skipping || isTimeExpired}
                    id="submit-coding-btn"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        <span>Evaluating Solution...</span>
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        <span>Submit Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <AnswerComposer
              answer={answer}
              onAnswerChange={setAnswer}
              mode={mode}
              onModeChange={handleModeChange}
              isListening={isListening}
              interimTranscript={interimTranscript}
              speechStatus={speechStatus}
              speechError={speechError}
              isSpeechSupported={isSpeechSupported}
              onStartSpeaking={handleStartSpeaking}
              onStopSpeaking={handleStopSpeaking}
              onSubmit={handleSubmit}
              onSkip={handleInitiateSkip}
              onClear={handleClearAnswer}
              submitting={submitting}
              skipping={skipping}
              mediaSubmitting={mediaSubmitting}
              disabled={!currentQuestion || isTimeExpired}
              hasAudioAttached={Boolean(audioBlob)}
              hasVideoAttached={Boolean(videoBlob)}
            />
          )}

          {error && (
            <div className="interview-error-banner animate-fade-in">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Previous Question Answer Evaluation Feedback */}
          {lastEval && (
            <div className="previous-eval-card glass-card animate-fade-in">
              <div className="previous-eval-header">
                <div className="eval-status-left">
                  <ShieldCheck size={16} className="eval-success-icon" />
                  <span className="eval-card-title">Previous Answer Evaluated</span>
                </div>
                <div className="eval-tag-group">
                  <span className="badge badge-green">AI Evaluated</span>
                  <span className="eval-score-badge">
                    {lastEval.textEvaluation?.textScore ?? lastEval.evaluation?.score ?? '—'}/100
                  </span>
                </div>
              </div>

              {lastEval.textEvaluation?.strengths?.length > 0 && (
                <div className="eval-concepts-row">
                  <span className="concepts-label">Covered Strengths:</span>
                  <div className="concept-tags-list">
                    {lastEval.textEvaluation.strengths.slice(0, 3).map((s, i) => (
                      <span key={i} className="concept-chip concept-covered">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {lastEval.textEvaluation?.missingConcepts?.length > 0 && (
                <div className="eval-concepts-row">
                  <span className="concepts-label">Suggested Additions:</span>
                  <div className="concept-tags-list">
                    {lastEval.textEvaluation.missingConcepts.slice(0, 3).map((c, i) => (
                      <span key={i} className="concept-chip concept-missing">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {(lastEval.textEvaluation?.feedback || lastEval.evaluation?.feedback) && (
                <p className="eval-feedback-paragraph">
                  {lastEval.textEvaluation?.feedback || lastEval.evaluation?.feedback}
                </p>
              )}

              {lastEval.textEvaluation?.improvementSuggestion && (
                <div className="eval-improvement-row">
                  <SparklesIcon size={12} />
                  <span>{lastEval.textEvaluation.improvementSuggestion}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Sidebar: Video Preview, Session Progress & Adaptive Info */}
        <aside className="interview-sidebar">
          {/* Candidate Camera Preview (when video mode selected) */}
          {mode === 'video' && (
            <div className="sidebar-card camera-card glass-card">
              <VideoRecorder
                ref={videoRecorderRef}
                isRecording={isMediaRecording && mode === 'video'}
                onRecordingComplete={(blob) => setVideoBlob(blob)}
                disabled={submitting || skipping || isTimeExpired}
              />
            </div>
          )}

          {/* Session Progress Card */}
          <div className="sidebar-card glass-card">
            <div className="sidebar-card-header">
              <span className="sidebar-card-title">Session Progress</span>
              <span className="progress-fraction">{currentQIndex} / {totalQ} completed</span>
            </div>

            <div className="sidebar-progress-track">
              <div
                className="sidebar-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="progress-stats-grid">
              <div className="stat-box">
                <span className="stat-num">{answeredCount}</span>
                <span className="stat-label">Answered</span>
              </div>
              <div className="stat-box">
                <span className="stat-num" style={{ color: '#f59e0b' }}>{skippedCount}</span>
                <span className="stat-label">Skipped</span>
              </div>
              <div className="stat-box">
                <span className="stat-num">{Math.max(0, totalQ - currentQIndex)}</span>
                <span className="stat-label">Remaining</span>
              </div>
            </div>
          </div>

          {/* Adaptive Intelligence Panel */}
          <div className="sidebar-card glass-card">
            <div className="sidebar-card-header">
              <span className="sidebar-card-title">Adaptive Intelligence</span>
              <Brain size={13} className="text-secondary" />
            </div>

            <div className="adaptive-meta-list">
              <div className="adaptive-data-row">
                <span className="data-key">Difficulty</span>
                <span className={`badge ${DIFFICULTY_COLORS[interview?.interviewState?.currentDifficulty || interview?.difficulty || 'medium']}`}>
                  {interview?.interviewState?.currentDifficulty || interview?.difficulty || 'medium'}
                </span>
              </div>

              <div className="adaptive-data-row">
                <span className="data-key">Target Role</span>
                <span className="data-value-text">{interview?.targetRole || 'Software Engineer'}</span>
              </div>

              {interview?.interviewState?.strongAreas?.length > 0 && (
                <div className="adaptive-data-row">
                  <span className="data-key">Demonstrated</span>
                  <div className="skill-tag-group">
                    {interview.interviewState.strongAreas.slice(0, 3).map((s, idx) => (
                      <span key={idx} className="skill-mini-chip chip-emerald">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {interview?.interviewState?.weakAreas?.length > 0 && (
                <div className="adaptive-data-row">
                  <span className="data-key">Developing</span>
                  <div className="skill-tag-group">
                    {interview.interviewState.weakAreas.slice(0, 3).map((w, idx) => (
                      <span key={idx} className="skill-mini-chip chip-amber">{w}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Multimodal Evaluation Pipeline Status */}
          <div className="sidebar-card glass-card">
            <div className="sidebar-card-header">
              <span className="sidebar-card-title">AI Evaluation Pipeline</span>
              <Layers size={13} className="text-secondary" />
            </div>

            <div className="pipeline-items">
              <div className="pipeline-item active">
                <span className="pipeline-dot live-dot" />
                <span className="pipeline-name">Answer Evaluation</span>
                <span className="pipeline-badge ready">Active</span>
              </div>

              <div className={`pipeline-item ${mode === 'audio' || mode === 'video' ? 'active' : ''}`}>
                <span className={`pipeline-dot ${mode === 'audio' || mode === 'video' ? 'live-dot' : ''}`} />
                <span className="pipeline-name">Speech Analysis</span>
                <span className={`pipeline-badge ${mode === 'audio' || mode === 'video' ? 'ready' : 'standby'}`}>
                  {mode === 'audio' || mode === 'video' ? 'Active' : 'Standby'}
                </span>
              </div>

              <div className={`pipeline-item ${mode === 'video' ? 'active' : ''}`}>
                <span className={`pipeline-dot ${mode === 'video' ? 'live-dot' : ''}`} />
                <span className="pipeline-name">Video Analysis</span>
                <span className={`pipeline-badge ${mode === 'video' ? 'ready' : 'standby'}`}>
                  {mode === 'video' ? 'Active' : 'Standby'}
                </span>
              </div>

              <div className="pipeline-item">
                <span className="pipeline-dot" />
                <span className="pipeline-name">Multimodal Fusion</span>
                <span className="pipeline-badge standby">On Submit</span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

function SparklesIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  )
}
