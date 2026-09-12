import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthApi } from '../services/api'
import {
  Brain, Clock, Tag, BarChart2, AlertCircle,
  ChevronRight, CheckCircle, Info,
  TrendingUp, Zap, BookOpen, Layers, Target, ShieldCheck,
  SkipForward, AlertTriangle, Send, Loader2, Video, VideoOff, Mic, MicOff
} from 'lucide-react'
import useSpeechRecognition, { normalizeTranscriptJoin } from '../hooks/useSpeechRecognition'
import AnswerComposer from '../components/AnswerComposer'
import VideoRecorder from '../components/VideoRecorder'
import AudioRecorder from '../components/AudioRecorder'
import FloatingCamera from '../components/FloatingCamera'
import './InterviewPage.css'

const CATEGORY_COLORS = {
  introduction: 'badge-cyan',
  resume: 'badge-green',
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
  job_description: 'badge-purple',
}

const DIFFICULTY_COLORS = {
  easy: 'badge-green',
  medium: 'badge-yellow',
  hard: 'badge-red',
}

const TYPE_ICONS = {
  introduction: '👋',
  resume: '📄',
  technical: '⚙️',
  coding: '💻',
  project: '🏗️',
  experience: '💼',
  behavioral: '🤝',
  job_specific: '🎯',
  skill_gap: '📊',
  follow_up: '↩️',
}

// Helper to calculate exact remaining seconds based on server expiresAt or started timestamp
const calculateRemainingSeconds = (startedAt, durationMinutes = 30, expiresAt = null) => {
  if (expiresAt) {
    const end = new Date(expiresAt).getTime()
    return Math.max(0, Math.floor((end - Date.now()) / 1000))
  }
  if (!startedAt) return (durationMinutes || 30) * 60
  const startTime = new Date(startedAt).getTime()
  const endTime = startTime + (durationMinutes || 30) * 60 * 1000
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
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [error, setError] = useState(null)
  const [lastEval, setLastEval] = useState(null)
  const [isComplete, setIsComplete] = useState(false)

  // Video mode state — user can optionally enable camera
  const [videoEnabled, setVideoEnabled] = useState(false)

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
  // Track whether speech was auto-started for this question
  const autoStartedSpeechRef = useRef(false)

  // Speech-to-Text Integration
  // When a final speech segment is confirmed, append non-destructively with punctuation awareness
  const handleFinalTranscript = useCallback((phrase) => {
    setAnswer((prev) => normalizeTranscriptJoin(prev, phrase))
  }, [])

  const {
    isSupported: isSpeechSupported,
    isListening,
    interimTranscript,
    status: speechStatus,
    error: speechError,
    startListening,
    stopListening,
    flushAndStop,
    reset: resetSpeech,
  } = useSpeechRecognition({ onFinalTranscript: handleFinalTranscript })

  // Initialize Interview Session
  useEffect(() => {
    if (!isLoaded || !id) return
    if (!isSignedIn) {
      setError('Your session could not be verified. Please sign in again.')
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

        if (data.interview?.videoModeEnabled) {
          setVideoEnabled(true)
        }

        const totalAllowed = data.interview?.configuredQuestionCount || data.interview?.totalQuestions || 5
        const isInterviewDone =
          data.isComplete ||
          data.interview?.status === 'completed' ||
          data.interview?.isComplete ||
          !data.currentQuestion ||
          (data.interview?.currentQuestionIndex >= totalAllowed)

        setIsComplete(isInterviewDone)

        if (isInterviewDone) {
          navigate(`/interview/${id}/results`)
          return
        }

        // Calculate exact remaining time from backend startedAt, durationMinutes & expiresAt
        const rem = calculateRemainingSeconds(
          data.interview?.startedAt,
          data.interview?.durationMinutes,
          data.interview?.expiresAt || data.expiresAt
        )
        setRemainingSeconds(rem)
      } catch (err) {
        const msg = err.message || ''
        if (msg.includes('already completed') || msg.includes('INTERVIEW_COMPLETED')) {
          setIsComplete(true)
          navigate(`/interview/${id}/results`)
          return
        }
        startedRef.current = null
        setError(msg || 'Could not start interview.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id, isLoaded, isSignedIn])

  // Auto-start speech recognition when a new question becomes active
  useEffect(() => {
    if (!currentQuestion || loading || isComplete) return
    // Only auto-start if speech is supported and not already listening
    if (!isSpeechSupported) return
    if (isListening) return
    // Prevent duplicate starts for the same question
    if (autoStartedSpeechRef.current === currentQuestion.id) return

    autoStartedSpeechRef.current = currentQuestion.id
    // Small delay to allow question animation to settle
    const timer = setTimeout(() => {
      startListening()
      setIsMediaRecording(true)
    }, 400)
    return () => clearTimeout(timer)
  }, [currentQuestion?.id, loading, isComplete, isSpeechSupported])

  // Workspace ref for bounding floating draggable camera
  const workspaceRef = useRef(null)

  // Real-time Countdown Timer (persists on refresh, never resets on re-render)
  useEffect(() => {
    if (isComplete || loading || !interview?.startedAt) return

    const tick = () => {
      setQuestionTimer((t) => t + 1)
      const rem = calculateRemainingSeconds(interview.startedAt, interview.durationMinutes, interview.expiresAt)
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
  }, [isComplete, loading, interview?.startedAt, interview?.durationMinutes, interview?.expiresAt])

  // Automatic interview completion when timer hits 00:00
  const handleTimeoutAutoEnd = async () => {
    setTimeoutNotice(true)
    // Flush any pending interim speech and stop dictation
    if (flushAndStop) {
      flushAndStop()
    } else if (isListening) {
      stopListening()
    }
    setIsMediaRecording(false)

    try {
      // Auto-save draft answer if candidate typed anything
      const draft = (answer || '').trim()
      if (draft && currentQuestion) {
        const qId = currentQuestion.id || currentQuestion._id
        await authApi.post(`/api/interviews/${id}/responses`, {
          questionId: qId,
          answerText: draft,
          responseType: 'text',
        }).catch((e) => console.warn('[Interview] Draft auto-submit on timeout:', e.message))
      }

      await authApi.post(`/api/interviews/${id}/complete`, {
        completionReason: 'time_expired',
      })
      setTimeout(() => {
        navigate(`/interview/${id}/results`)
      }, 1200)
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

  // Toggle video mode on/off
  const handleToggleVideo = () => {
    setVideoEnabled((prev) => !prev)
    if (videoEnabled) {
      // Turning off video — stop video recording
      setIsMediaRecording(false)
    } else {
      // Turning on video — start recording
      setIsMediaRecording(true)
    }
  }

  // Clear Answer
  const handleClearAnswer = () => {
    if (flushAndStop) {
      flushAndStop()
    } else if (isListening) {
      stopListening()
    }
    setIsMediaRecording(false)
    setAnswer('')
    setAudioBlob(null)
    setVideoBlob(null)
    resetSpeech()
    // Restart speech after clear
    setTimeout(() => {
      if (isSpeechSupported && !isListening) {
        startListening()
        setIsMediaRecording(true)
      }
    }, 200)
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

  // Submit Answer Flow
  const handleSubmit = async () => {
    if (!currentQuestion) return

    // Flush any pending speech buffer and stop
    let textToSubmit = answer || ''
    try {
      if (typeof flushAndStop === 'function') {
        const flushResult = flushAndStop()
        const flushed = flushResult?.flushedText || interimTranscript || ''
        if (flushed && flushed.trim()) {
          textToSubmit = normalizeTranscriptJoin(textToSubmit, flushed.trim())
        }
      } else if (isListening) {
        stopListening()
      }
    } catch (e) {
      console.warn('[Interview] flush error on submit:', e)
    }
    setIsMediaRecording(false)

    textToSubmit = (textToSubmit || '').trim()
    if (!textToSubmit) {
      setError('Please provide an answer before submitting.')
      return
    }

    setSubmitting(true)
    setError(null)
    setQuestionTimer(0)

    try {
      const qId = currentQuestion.id || currentQuestion._id
      const payload = {
        questionId: qId,
        answerText: textToSubmit,
        responseType: 'text',
        code: null,
        language: null,
      }

      // Stop video recorder and get confirmed blob
      let currentVideo = videoBlob
      if (videoEnabled && videoRecorderRef.current?.stopAndGetBlob) {
        try {
          const recorded = await videoRecorderRef.current.stopAndGetBlob()
          if (recorded && recorded.size > 0) {
            currentVideo = recorded
          }
        } catch (e) {
          console.warn('[InterviewPage] error stopping video recorder:', e)
        }
      }

      const res = await authApi.post(`/api/interviews/${id}/responses`, payload)

      const responseId = res.data.response?.id || res.data.response?._id
      const currentAudio = audioBlob

      // Concurrently submit supporting audio/video modalities
      if (responseId && (currentAudio || currentVideo)) {
        await submitMedia(responseId, qId, currentAudio, currentVideo)
      }

      // Update UI state & next question
      setLastEval(res.data.response)
      setAnswer('')
      setAudioBlob(null)
      setVideoBlob(null)
      resetSpeech()
      setInterview(res.data.interview)
      // Reset auto-started ref so next question triggers auto-listen
      autoStartedSpeechRef.current = null

      const interviewData = res.data?.interview
      const nextQ = res.data?.nextQuestion
      const totalAllowed = interviewData?.configuredQuestionCount || interviewData?.totalQuestions || totalQ
      const isFinished =
        res.data?.isComplete ||
        interviewData?.isComplete ||
        interviewData?.status === 'completed' ||
        !nextQ ||
        (interviewData?.currentQuestionIndex >= totalAllowed)

      if (isFinished) {
        setIsComplete(true)
        setCurrentQuestion(null)
        navigate(`/interview/${id}/results`)
      } else {
        setCurrentQuestion(nextQ)
      }
    } catch (err) {
      console.error('[Interview] Submit error:', err)
      const msg = err.response?.data?.message || err.message || ''
      if (
        msg.includes('already completed') ||
        msg.includes('INTERVIEW_COMPLETED') ||
        msg.includes('RESPONSE_EXISTS') ||
        msg.includes('already submitted')
      ) {
        setIsComplete(true)
        setCurrentQuestion(null)
        navigate(`/interview/${id}/results`)
        return
      }
      setError(msg || 'Could not submit answer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Skip Question Flow
  const handleInitiateSkip = () => {
    if (submitting || skipping) return
    const hasDraftAnswer = answer && answer.trim().length > 0
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

    // Stop active dictation and media capture cleanly
    if (flushAndStop) {
      flushAndStop()
    } else if (isListening) {
      stopListening()
    }
    setIsMediaRecording(false)

    try {
      const res = await authApi.post(`/api/interviews/${id}/questions/${currentQuestion.id}/skip`, {
        reason: 'candidate_skipped',
      })

      // Reset composer fields
      setAnswer('')
      setAudioBlob(null)
      setVideoBlob(null)
      resetSpeech()
      setInterview(res.data?.interview)
      // Reset auto-started ref so next question triggers auto-listen
      autoStartedSpeechRef.current = null

      const interviewData = res.data?.interview
      const totalAllowed = interviewData?.configuredQuestionCount || interviewData?.totalQuestions || totalQ
      const isFinished =
        res.data?.isComplete ||
        interviewData?.isComplete ||
        interviewData?.status === 'completed' ||
        !res.data?.nextQuestion ||
        (interviewData?.currentQuestionIndex >= totalAllowed)

      if (isFinished) {
        setIsComplete(true)
        setCurrentQuestion(null)
        navigate(`/interview/${id}/results`)
      } else {
        setCurrentQuestion(res.data.nextQuestion)
      }
    } catch (err) {
      const msg = err.message || ''
      if (
        msg.includes('already been skipped') ||
        msg.includes('already completed') ||
        msg.includes('ALREADY_SKIPPED') ||
        msg.includes('INTERVIEW_COMPLETED')
      ) {
        // If question was already skipped or interview is done, finish gracefully
        setIsComplete(true)
        setCurrentQuestion(null)
        navigate(`/interview/${id}/results`)
      } else {
        setError(msg || 'Could not skip question. Please try again.')
      }
    } finally {
      setSkipping(false)
    }
  }

  // End Interview Flow
  const handleEndInterview = async () => {
    if (!window.confirm('End interview now? This will complete your interview session and generate your evaluation.')) {
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
  const totalQ = interview?.configuredQuestionCount || interview?.totalQuestions || 5
  const currentQIndex = interview?.currentQuestionIndex ?? 0
  const skippedCount = interview?.skippedQuestionsCount || 0
  const answeredCount = Math.max(0, currentQIndex - skippedCount)
  const progressPercent = Math.min(100, Math.round((currentQIndex / totalQ) * 100))

  // Timer states
  const isUrgentTime = remainingSeconds <= 60 && remainingSeconds > 0
  const isWarningTime = remainingSeconds <= 300 && remainingSeconds > 60
  const isTimeExpired = remainingSeconds === 0

  // ─── Loading Screen ───────────────────────────────────────────────────────
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

  // ─── Complete Screen ──────────────────────────────────────────────────────
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

  // ─── Error Screen (Session Out / Invalid Interview) ──────────────────────
  if (!loading && (!interview || error)) {
    const isSessionError = (error || '').toLowerCase().includes('session') || (error || '').toLowerCase().includes('unauthorized')
    return (
      <div className="interview-loading animate-fade-in">
        <div className="loading-spinner-box">
          <AlertTriangle size={36} color="#ef4444" />
        </div>
        <h2 className="loading-title">{isSessionError ? 'Session Out' : 'Unable to Load Interview'}</h2>
        <p className="loading-subtitle">{error || 'Interview session data could not be retrieved.'}</p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              startedRef.current = null
              setError(null)
              setLoading(true)
              window.location.reload()
            }}
          >
            Retry Connection
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
    )
  }

  // ─── Main Interview UI ────────────────────────────────────────────────────
  return (
    <div className="interview-page" ref={workspaceRef}>
      {/* Background Audio Recorder (silent capture when speech/audio active) */}
      <AudioRecorder
        ref={audioRecorderRef}
        isRecording={isMediaRecording && !videoEnabled}
        onRecordingComplete={(blob) => setAudioBlob(blob)}
        disabled={submitting || skipping}
      />

      {/* Floating Draggable Candidate Camera Feed */}
      <FloatingCamera
        containerRef={workspaceRef}
        videoEnabled={videoEnabled}
        onToggleVideo={handleToggleVideo}
        isListening={isListening}
        isMediaRecording={isMediaRecording}
        speechError={speechError}
        isSpeechSupported={isSpeechSupported}
        videoRecorderRef={videoRecorderRef}
        onVideoBlob={setVideoBlob}
        disabled={submitting || skipping || isTimeExpired}
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

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="interview-topbar">
        <div className="interview-topbar-inner">
          <div className="topbar-left">
            <div className="interview-brand" onClick={() => navigate('/dashboard')} role="button" tabIndex={0}>
              <Brain size={20} className="brand-icon" />
              <span className="brand-name">InterviewX</span>
            </div>

            <div className="interview-meta-pills">
              <span className="pill pill-type">
                {interview?.interviewType
                  ? `${interview.interviewType.charAt(0).toUpperCase() + interview.interviewType.slice(1)} Interview`
                  : 'Technical Interview'}
              </span>
              <span className="pill pill-adaptive">
                <SparklesIcon size={12} />
                <span>Adaptive AI</span>
              </span>
            </div>
          </div>

          <div className="topbar-center">
            <span className="topbar-question-counter">
              Question <strong>{Math.min(currentQIndex + 1, totalQ)}</strong> of <strong>{totalQ}</strong>
            </span>
          </div>

          <div className="topbar-right">
            {/* Camera feed toggle button */}
            <button
              type="button"
              className={`btn-topbar-camera ${videoEnabled ? 'active' : ''}`}
              onClick={handleToggleVideo}
              disabled={submitting || skipping || isTimeExpired}
              title={videoEnabled ? 'Disable camera feed' : 'Enable candidate camera'}
            >
              {videoEnabled ? <Video size={14} /> : <VideoOff size={14} />}
              <span>{videoEnabled ? 'Camera On' : 'Camera Off'}</span>
            </button>

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
              onClick={handleEndInterview}
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

      {/* ── 3-Column Main Layout ─────────────────────────────────────────── */}
      <main className="interview-main-layout">

        {/* ── LEFT PANEL: Question + Guidance ──────────────────────────────── */}
        <section className="interview-left-panel">

          {/* Active Question Card */}
          {currentQuestion ? (
            <article className="question-card glass-card animate-fade-in" key={currentQuestion.id}>
              {/* Question meta header */}
              <div className="question-card-header">
                <div className="question-pill-group">
                  <span className="question-num-tag">
                    {TYPE_ICONS[currentQuestion.type] || '❓'} Q{currentQIndex + 1} / {totalQ}
                  </span>
                  <span className={`badge ${CATEGORY_COLORS[currentQuestion.category] || 'badge-purple'}`}>
                    <Tag size={11} />
                    <span style={{ textTransform: 'capitalize' }}>{currentQuestion.category}</span>
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

              {/* Expected Topics / Focus Areas */}
              {currentQuestion.expectedTopics && currentQuestion.expectedTopics.length > 0 && (
                <div className="question-topics-box">
                  <span className="topics-label">Key Topics Expected:</span>
                  <div className="topics-list">
                    {currentQuestion.expectedTopics.map((topic, i) => (
                      <span key={i} className="topic-chip">{topic}</span>
                    ))}
                  </div>
                </div>
              )}

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

          {/* Question Guidance & Actions Card */}
          <div className="question-meta-card glass-card">
            <div className="meta-card-header">
              <span className="meta-card-title">Candidate Controls</span>
              <div className="media-status-row">
                <span className={`media-status-chip ${isListening ? 'active' : speechError ? 'error' : ''}`}>
                  <span className={`status-dot ${isListening ? 'live' : ''}`} />
                  {isListening ? 'Mic live' : speechError ? 'Mic unavailable' : isSpeechSupported ? 'Mic ready' : 'Mic off'}
                </span>
                {videoEnabled && (
                  <span className="media-status-chip active">
                    <span className="status-dot live" />
                    Cam live
                  </span>
                )}
              </div>
            </div>

            <p className="meta-card-desc">
              Answer with concrete technical reasoning, architectural decisions, and trade-offs. You may type or use dictation.
            </p>

            <div className="meta-card-actions">
              <button
                type="button"
                className="btn btn-skip-left"
                onClick={handleInitiateSkip}
                disabled={submitting || skipping || isTimeExpired}
                id="skip-question-btn"
                title="Skip question without penalty"
              >
                {skipping ? (
                  <><Loader2 size={15} className="spin" /><span>Skipping...</span></>
                ) : (
                  <><SkipForward size={15} /><span>Skip Question</span></>
                )}
              </button>
              <span className="skip-hint-text">
                Skipping advances to the next question without lowering your evaluation score.
              </span>
            </div>
          </div>
        </section>

        {/* ── CENTER PANEL: Answer / Input ──────────────────────────────── */}
        <section className="interview-center-panel">
          <AnswerComposer
            answer={answer}
            onAnswerChange={setAnswer}
            isListening={isListening}
            interimTranscript={interimTranscript}
            speechStatus={speechStatus}
            speechError={speechError}
            isSpeechSupported={isSpeechSupported}
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

          {error && (
            <div className="interview-error-banner animate-fade-in">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Previous Answer Evaluation Feedback */}
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

        {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────── */}
        <aside className="interview-sidebar">

          {/* Session Progress Card */}
          <div className="sidebar-card glass-card">
            <div className="sidebar-card-header">
              <span className="sidebar-card-title">Session Progress</span>
              <span className="sidebar-card-subtitle">{currentQIndex} / {totalQ} completed</span>
            </div>

            <div className="sidebar-progress-track">
              <div
                className="sidebar-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="progress-stats-grid">
              <div className="stat-box">
                <span className="stat-num stat-answered">{answeredCount}</span>
                <span className="stat-label">Answered</span>
              </div>
              <div className="stat-box">
                <span className="stat-num stat-skipped">{skippedCount}</span>
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
              <Brain size={13} className="sidebar-card-icon" />
            </div>

            <div className="adaptive-meta-list">
              <div className="adaptive-data-row">
                <span className="data-key">Difficulty</span>
                <span className={`badge ${DIFFICULTY_COLORS[interview?.interviewState?.currentDifficulty || interview?.difficulty || 'medium']}`}>
                  {(interview?.interviewState?.currentDifficulty || interview?.difficulty || 'medium').charAt(0).toUpperCase()
                    + (interview?.interviewState?.currentDifficulty || interview?.difficulty || 'medium').slice(1)}
                </span>
              </div>

              <div className="adaptive-data-row">
                <span className="data-key">Target Role</span>
                <span className="data-value-text">{interview?.targetRole || 'Software Engineer'}</span>
              </div>

              {interview?.interviewState?.strongAreas?.length > 0 && (
                <div className="adaptive-data-row adaptive-data-row--wrap">
                  <span className="data-key">Demonstrated</span>
                  <div className="skill-tag-group">
                    {interview.interviewState.strongAreas.slice(0, 3).map((s, idx) => (
                      <span key={idx} className="skill-mini-chip chip-emerald">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {interview?.interviewState?.weakAreas?.length > 0 && (
                <div className="adaptive-data-row adaptive-data-row--wrap">
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

          {/* AI Evaluation Pipeline Status */}
          <div className="sidebar-card glass-card">
            <div className="sidebar-card-header">
              <span className="sidebar-card-title">AI Evaluation Pipeline</span>
              <Layers size={13} className="sidebar-card-icon" />
            </div>

            <div className="pipeline-items">
              <div className="pipeline-item active">
                <span className="pipeline-dot live-dot" />
                <span className="pipeline-name">Answer Evaluation</span>
                <span className="pipeline-badge ready">Active</span>
              </div>

              <div className={`pipeline-item ${isListening ? 'active' : ''}`}>
                <span className={`pipeline-dot ${isListening ? 'live-dot' : ''}`} />
                <span className="pipeline-name">Speech Analysis</span>
                <span className={`pipeline-badge ${isListening ? 'ready' : 'standby'}`}>
                  {isListening ? 'Active' : 'Standby'}
                </span>
              </div>

              <div className={`pipeline-item ${videoEnabled ? 'active' : ''}`}>
                <span className={`pipeline-dot ${videoEnabled ? 'live-dot' : ''}`} />
                <span className="pipeline-name">Video Analysis</span>
                <span className={`pipeline-badge ${videoEnabled ? 'ready' : 'standby'}`}>
                  {videoEnabled ? 'Active' : 'Standby'}
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
