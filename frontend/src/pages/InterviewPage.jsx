import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useAuthApi } from '../services/api'
import {
  Brain, CheckCircle, AlertTriangle, ShieldCheck,
  ChevronRight, Sparkles, AlertCircle
} from 'lucide-react'
import useSpeechRecognition from '../hooks/useSpeechRecognition'
import AnswerComposer from '../components/AnswerComposer'
import AudioRecorder from '../components/AudioRecorder'
import AICoachDrawer from '../components/AICoachDrawer'
import {
  InterviewHeader,
  QuestionCard,
  FloatingVideoWindow,
  EndInterviewModal,
  SkipConfirmModal,
} from '../components/interview'
import './InterviewPage.css'

export default function InterviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useUser()
  const { authApi, isLoaded, isSignedIn } = useAuthApi()

  // ── Core Interview State ──────────────────────────────────────────────────
  const [interview, setInterview] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [error, setError] = useState(null)
  const [lastEval, setLastEval] = useState(null)
  const [isComplete, setIsComplete] = useState(false)
  const [timeoutNotice, setTimeoutNotice] = useState(false)

  // ── Video & Audio Modalities ──────────────────────────────────────────────
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [isMicActive, setIsMicActive] = useState(true)
  const [audioBlob, setAudioBlob] = useState(null)
  const [videoBlob, setVideoBlob] = useState(null)
  const [isMediaRecording, setIsMediaRecording] = useState(false)
  const [mediaSubmitting, setMediaSubmitting] = useState(false)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const startedRef = useRef(null)
  const hasAutoCompletedRef = useRef(false)
  const videoRecorderRef = useRef(null)
  const audioRecorderRef = useRef(null)
  const autoStartedSpeechRef = useRef(null)

  // ── Speech-to-Text Integration ────────────────────────────────────────────
  const handleFinalTranscript = useCallback((phrase) => {
    if (!phrase) return
    setAnswer((prev) => {
      const trimmed = prev.trimEnd()
      if (!trimmed) return phrase
      return `${trimmed} ${phrase}`
    })
  }, [])

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

  // Keep isMicActive synchronized with listening state
  useEffect(() => {
    setIsMicActive(isListening)
  }, [isListening])

  // ── Initialize or Recover Interview Session ───────────────────────────────
  useEffect(() => {
    if (!isLoaded || !id) return
    if (!isSignedIn) {
      setError('Your session could not be verified. Please sign in again.')
      setLoading(false)
      return
    }
    if (startedRef.current === id) return
    startedRef.current = id

    const initInterview = async () => {
      setLoading(true)
      try {
        const res = await authApi.post(`/api/interviews/${id}/start`)
        const data = res.data
        setInterview(data.interview)
        setCurrentQuestion(data.currentQuestion)

        const isInterviewDone =
          data.isComplete ||
          data.interview?.status === 'completed' ||
          data.interview?.isComplete ||
          !data.currentQuestion ||
          (data.interview?.currentQuestionIndex >= data.interview?.totalQuestions)

        setIsComplete(isInterviewDone)

        if (isInterviewDone) {
          navigate(`/interview/${id}/results`)
          return
        }
      } catch (err) {
        const msg = err.message || ''
        if (msg.includes('already completed') || msg.includes('INTERVIEW_COMPLETED')) {
          setIsComplete(true)
          navigate(`/interview/${id}/results`)
          return
        }
        startedRef.current = null
        setError(msg || 'Could not start or recover interview session.')
      } finally {
        setLoading(false)
      }
    }

    initInterview()
  }, [id, isLoaded, isSignedIn, navigate, authApi])

  // ── Auto-start Speech Recognition for New Questions ───────────────────────
  useEffect(() => {
    if (!currentQuestion || loading || isComplete) return
    if (!isSpeechSupported) return
    if (isListening) return
    if (autoStartedSpeechRef.current === currentQuestion.id) return

    autoStartedSpeechRef.current = currentQuestion.id
    const timer = setTimeout(() => {
      startListening()
      setIsMediaRecording(true)
    }, 400)

    return () => clearTimeout(timer)
  }, [currentQuestion?.id, loading, isComplete, isSpeechSupported, isListening, startListening])

  // ── Timeout Expiry Handler (Hits 00:00) ────────────────────────────────────
  const handleTimeoutAutoEnd = useCallback(async () => {
    if (hasAutoCompletedRef.current || completing) return
    hasAutoCompletedRef.current = true
    setCompleting(true)
    setTimeoutNotice(true)

    // Stop speech recognition and media recording
    if (isListening) stopListening()
    setIsMediaRecording(false)

    try {
      await authApi.post(`/api/interviews/${id}/complete`, {
        completionReason: 'time_expired',
      })
      setTimeout(() => {
        navigate(`/interview/${id}/results`)
      }, 1200)
    } catch (err) {
      console.warn('[Interview] Timeout completion notice:', err.message)
      navigate(`/interview/${id}/results`)
    }
  }, [id, isListening, stopListening, authApi, navigate, completing])

  // ── Toggle Devices ────────────────────────────────────────────────────────
  const handleToggleVideo = useCallback(() => {
    setVideoEnabled((prev) => !prev)
  }, [])

  const handleToggleMic = useCallback(() => {
    if (isListening) {
      stopListening()
      setIsMicActive(false)
    } else {
      if (isSpeechSupported) {
        startListening()
        setIsMicActive(true)
      }
    }
  }, [isListening, isSpeechSupported, startListening, stopListening])

  // ── Clear Answer ──────────────────────────────────────────────────────────
  const handleClearAnswer = useCallback(() => {
    if (isListening) {
      stopListening()
      setIsMediaRecording(false)
    }
    setAnswer('')
    setAudioBlob(null)
    setVideoBlob(null)
    resetSpeech()

    setTimeout(() => {
      if (isSpeechSupported) {
        startListening()
        setIsMediaRecording(true)
      }
    }, 200)
  }, [isListening, isSpeechSupported, resetSpeech, startListening, stopListening])

  // ── Media Upload Synchronization (Background) ─────────────────────────────
  const submitMedia = async (responseId, questionId, curAudioBlob, curVideoBlob) => {
    const promises = []

    if (curAudioBlob) {
      const formData = new FormData()
      formData.append('audio', curAudioBlob, 'recording.webm')
      formData.append('responseId', responseId)
      formData.append('questionId', questionId)
      promises.push(
        authApi
          .post(`/api/interviews/${id}/audio-response`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          .catch((e) => console.warn('[Interview] Audio upload notice:', e.message))
      )
    }

    if (curVideoBlob) {
      const formData = new FormData()
      formData.append('video', curVideoBlob, 'recording.webm')
      formData.append('responseId', responseId)
      formData.append('questionId', questionId)
      promises.push(
        authApi
          .post(`/api/interviews/${id}/video-response`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          .catch((e) => console.warn('[Interview] Video upload notice:', e.message))
      )
    }

    if (promises.length > 0) {
      setMediaSubmitting(true)
      await Promise.all(promises).finally(() => setMediaSubmitting(false))
    }
  }

  // ── Submit Answer ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!currentQuestion || submitting || skipping || completing || isComplete) return

    if (isListening) stopListening()
    setIsMediaRecording(false)

    const textToSubmit = answer.trim()
    if (!textToSubmit) return

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        questionId: currentQuestion.id,
        answerText: textToSubmit,
        responseType: 'text',
        code: null,
        language: null,
      }

      const res = await authApi.post(`/api/interviews/${id}/responses`, payload)

      const responseId = res.data.response?.id
      const questionId = currentQuestion.id
      const currentAudio = audioBlob
      const currentVideo = videoBlob

      // Background upload of audio/video modalities for Librosa & YOLO evaluation
      submitMedia(responseId, questionId, currentAudio, currentVideo)

      setLastEval(res.data.response)
      setAnswer('')
      setAudioBlob(null)
      setVideoBlob(null)
      resetSpeech()
      setInterview(res.data.interview)
      autoStartedSpeechRef.current = null

      const interviewData = res.data?.interview
      const isFinished =
        res.data?.isComplete ||
        interviewData?.isComplete ||
        interviewData?.status === 'completed' ||
        !res.data?.nextQuestion ||
        interviewData?.currentQuestionIndex >= interviewData?.totalQuestions

      if (isFinished) {
        setIsComplete(true)
        setCurrentQuestion(null)
        navigate(`/interview/${id}/results`)
      } else {
        setCurrentQuestion(res.data.nextQuestion)
      }
    } catch (err) {
      setError(err.message || 'Could not submit answer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Skip Question ─────────────────────────────────────────────────────────
  const handleInitiateSkip = () => {
    if (submitting || skipping || completing || isComplete) return
    const hasDraftAnswer = answer && answer.trim().length > 0
    if (hasDraftAnswer || isListening) {
      setShowSkipConfirm(true)
    } else {
      executeSkip()
    }
  }

  const executeSkip = async () => {
    if (!currentQuestion || skipping || submitting || completing) return
    setShowSkipConfirm(false)
    setSkipping(true)
    setError(null)

    if (isListening) stopListening()
    setIsMediaRecording(false)

    try {
      const res = await authApi.post(
        `/api/interviews/${id}/questions/${currentQuestion.id}/skip`,
        { reason: 'candidate_skipped' }
      )

      setAnswer('')
      setAudioBlob(null)
      setVideoBlob(null)
      resetSpeech()
      setInterview(res.data?.interview)
      autoStartedSpeechRef.current = null

      const interviewData = res.data?.interview
      const isFinished =
        res.data?.isComplete ||
        interviewData?.isComplete ||
        interviewData?.status === 'completed' ||
        !res.data?.nextQuestion ||
        interviewData?.currentQuestionIndex >= interviewData?.totalQuestions

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

  // ── Manual End Interview ──────────────────────────────────────────────────
  const handleConfirmEnd = async () => {
    if (completing) return
    setShowEndConfirm(false)
    setCompleting(true)

    if (isListening) stopListening()
    setIsMediaRecording(false)

    try {
      await authApi.post(`/api/interviews/${id}/complete`, {
        completionReason: 'user_ended',
      })
      navigate(`/interview/${id}/results`)
    } catch (err) {
      setError(err.message || 'Failed to complete interview.')
      setCompleting(false)
    }
  }

  // Progress metrics
  const totalQ = interview?.totalQuestions || 10
  const currentQIndex = interview?.currentQuestionIndex ?? 0
  const progressPercent = Math.min(100, Math.round((currentQIndex / totalQ) * 100))

  // ── Loading View ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="interview-loading animate-fade-in">
        <div className="loading-spinner-box">
          <Brain size={38} className="brand-pulse-icon" />
          <div className="custom-loader" />
        </div>
        <h2 className="loading-title">Setting Up Your Interview Cockpit</h2>
        <p className="loading-subtitle">Configuring adaptive question sequence & evaluation environment...</p>
      </div>
    )
  }

  // ── Completed View ────────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="interview-complete animate-fade-in">
        <div className="complete-card glass-card">
          <div className="complete-badge-icon">
            <CheckCircle size={44} className="complete-success-icon" />
          </div>
          <h1 className="complete-title">Interview Completed</h1>
          <p className="complete-subtitle">
            Your interview has concluded. Generating your comprehensive multi-dimensional assessment report...
          </p>
          <div className="complete-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => navigate(`/interview/${id}/results`)}
            >
              <span>View Assessment Results</span>
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

  // ── Error View ────────────────────────────────────────────────────────────
  if (!loading && (!interview || error)) {
    return (
      <div className="interview-loading animate-fade-in">
        <div className="loading-spinner-box">
          <AlertTriangle size={36} color="#ef4444" />
        </div>
        <h2 className="loading-title">Unable to Load Interview</h2>
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

  // ── Main Interview Cockpit ────────────────────────────────────────────────
  return (
    <div className="interview-page interview-cockpit">
      {/* Background Audio Recorder for multimodal Librosa analysis */}
      <AudioRecorder
        ref={audioRecorderRef}
        isRecording={isMediaRecording}
        onRecordingComplete={(blob) => setAudioBlob(blob)}
        disabled={submitting || skipping || completing}
      />

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <InterviewHeader
        targetRole={interview?.targetRole || 'Software Engineer'}
        interviewType={interview?.interviewType || 'Technical Interview'}
        startedAt={interview?.startedAt}
        durationMinutes={interview?.durationMinutes || 30}
        onTimerExpire={handleTimeoutAutoEnd}
        isComplete={isComplete}
        videoEnabled={videoEnabled}
        isMicActive={isMicActive}
        onEndInterview={() => setShowEndConfirm(true)}
        onBrandClick={() => navigate('/dashboard')}
      />

      {/* Progress Track */}
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

      {/* Timeout Alert Banner */}
      {timeoutNotice && (
        <div className="timeout-notice-banner animate-fade-in">
          <AlertTriangle size={18} />
          <span>Interview time has expired. Finalizing evaluation and saving your interview state...</span>
        </div>
      )}

      {/* ── Main Focused Interview Area ──────────────────────────────────── */}
      <main className="interview-cockpit-main">
        <div className="interview-content-container">
          {/* Primary Question Card */}
          <QuestionCard
            question={currentQuestion}
            questionNumber={Math.min(currentQIndex + 1, totalQ)}
            totalQuestions={totalQ}
          />

          {/* Answer Composer */}
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
            disabled={!currentQuestion || completing}
            hasAudioAttached={Boolean(audioBlob)}
            hasVideoAttached={Boolean(videoBlob)}
          />

          {/* Error Banner */}
          {error && (
            <div className="interview-error-banner animate-fade-in">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Evaluated Previous Answer (Collapsible / Unobtrusive Feedback) */}
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
                  <Sparkles size={12} />
                  <span>{lastEval.textEvaluation.improvementSuggestion}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Floating Candidate Video Window (Draggable, Minimizable) ─────── */}
      <FloatingVideoWindow
        interviewId={id}
        userName={user?.fullName || user?.firstName || 'Candidate'}
        videoEnabled={videoEnabled}
        onToggleVideo={handleToggleVideo}
        isMicActive={isMicActive}
        onToggleMic={handleToggleMic}
        isRecording={isMediaRecording && videoEnabled}
        onVideoBlob={(blob) => setVideoBlob(blob)}
        videoRecorderRef={videoRecorderRef}
        speechError={speechError}
        disabled={submitting || skipping || completing}
      />

      {/* ── Modals & Drawers ─────────────────────────────────────────────── */}
      <EndInterviewModal
        isOpen={showEndConfirm}
        onClose={() => setShowEndConfirm(false)}
        onConfirm={handleConfirmEnd}
        ending={completing}
      />

      <SkipConfirmModal
        isOpen={showSkipConfirm}
        onClose={() => setShowSkipConfirm(false)}
        onConfirm={executeSkip}
        skipping={skipping}
      />

      {/* Contextual AI Coach Drawer */}
      <AICoachDrawer activeInterviewId={id} currentQuestion={currentQuestion} />
    </div>
  )
}
