import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useAuthApi } from '../services/api'
import {
  CheckCircle, AlertTriangle, ShieldCheck,
  ChevronRight, Sparkles, AlertCircle, X
} from 'lucide-react'
import useSpeechRecognition from '../hooks/useSpeechRecognition'
import AnswerComposer from '../components/AnswerComposer'
import AudioRecorder from '../components/AudioRecorder'
import {
  InterviewHeader,
  QuestionCard,
  FloatingVideoWindow,
  InterviewSidebar,
  InterviewLoadingScreen,
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
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [lastEval, setLastEval] = useState(null)
  const [showLastEval, setShowLastEval] = useState(true)
  const [isComplete, setIsComplete] = useState(false)
  const [timeoutNotice, setTimeoutNotice] = useState(false)

  // ── Video & Audio Modalities ──────────────────────────────────────────────
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [isMicActive, setIsMicActive] = useState(true)
  const [audioBlob, setAudioBlob] = useState(null)
  const [videoBlob, setVideoBlob] = useState(null)
  const [isMediaRecording, setIsMediaRecording] = useState(false)
  const [mediaSubmitting, setMediaSubmitting] = useState(false)
  const [mediaNotice, setMediaNotice] = useState(null)

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

  // ── Auto-start Speech Recognition & Media Recording for New Questions ────
  useEffect(() => {
    if (!currentQuestion || loading || isComplete) return
    if (autoStartedSpeechRef.current === currentQuestion.id) return

    autoStartedSpeechRef.current = currentQuestion.id
    const timer = setTimeout(() => {
      if (isSpeechSupported && !isListening) {
        startListening()
      }
      setIsMediaRecording(true)
    }, 400)

    return () => clearTimeout(timer)
  }, [currentQuestion, loading, isComplete, isSpeechSupported, isListening, startListening])

  // ── Timeout Expiry Handler (Hits 00:00) ────────────────────────────────────
  const handleTimeoutAutoEnd = useCallback(async () => {
    if (hasAutoCompletedRef.current || completing) return
    hasAutoCompletedRef.current = true
    setCompleting(true)
    setTimeoutNotice(true)

    // Stop speech recognition and media recording
    if (isListening) stopListening()
    setIsMediaRecording(false)

    console.log('[InterviewLifecycle] completion_request_start', { interviewId: id, reason: 'time_expired' })
    const compStart = performance.now()
    try {
      await authApi.post(`/api/interviews/${id}/complete`, {
        completionReason: 'time_expired',
      })
      console.log('[InterviewLifecycle] completion_success', {
        interviewId: id,
        durationMs: Math.round(performance.now() - compStart),
      })
      console.log('[InterviewLifecycle] navigation_to_results', { interviewId: id })
      setTimeout(() => {
        navigate(`/interview/${id}/results`)
      }, 800)
    } catch (err) {
      console.warn('[InterviewLifecycle] Timeout completion notice:', err.message)
      console.log('[InterviewLifecycle] navigation_to_results', { interviewId: id })
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

  // ── Media Upload Synchronization (Structured Results) ─────────────────────
  const submitMedia = async (responseId, questionId, curAudioBlob, curVideoBlob) => {
    const results = {
      audio: { submitted: false, error: null, data: null },
      video: { submitted: false, error: null, data: null },
    }

    const tasks = []

    if (curAudioBlob && curAudioBlob.size > 0) {
      const formData = new FormData()
      formData.append('audio', curAudioBlob, 'recording.webm')
      formData.append('responseId', responseId)
      formData.append('questionId', questionId)
      tasks.push(
        authApi
          .post(`/api/interviews/${id}/audio-response`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          .then((res) => {
            results.audio = { submitted: true, error: null, data: res.data }
          })
          .catch((e) => {
            console.warn('[Interview] Audio upload notice:', e?.message || e)
            results.audio = {
              submitted: false,
              error: e?.response?.data?.message || e?.message || 'Audio upload failed',
              data: null,
            }
          })
      )
    }

    if (curVideoBlob && curVideoBlob.size > 0) {
      const formData = new FormData()
      formData.append('video', curVideoBlob, 'recording.webm')
      formData.append('responseId', responseId)
      formData.append('questionId', questionId)
      tasks.push(
        authApi
          .post(`/api/interviews/${id}/video-response`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          .then((res) => {
            results.video = { submitted: true, error: null, data: res.data }
          })
          .catch((e) => {
            console.warn('[Interview] Video upload notice:', e?.message || e)
            results.video = {
              submitted: false,
              error: e?.response?.data?.message || e?.message || 'Video upload failed',
              data: null,
            }
          })
      )
    }

    if (tasks.length > 0) {
      setMediaSubmitting(true)
      try {
        await Promise.all(tasks)
      } finally {
        setMediaSubmitting(false)
      }
    }

    return results
  }

  // ── Submit Answer ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!currentQuestion || submitting || skipping || completing || isComplete) return

    // 1. Stop speech recognition
    if (isListening) stopListening()

    // 2. Stop media recording and obtain completed Blobs before proceeding.
    // Do not gate this on React's isMediaRecording state: MediaRecorder has its
    // own lifecycle and can still contain the completed response when React state
    // has already changed (for example during a question transition).
    let currentVideo = videoBlob
    if (videoRecorderRef.current && videoEnabled) {
      try {
        const recordedVideo = await videoRecorderRef.current.stopAndGetBlob()
        if (recordedVideo && recordedVideo.size > 0) {
          currentVideo = recordedVideo
          console.log('[InterviewMedia] video_blob_ready', {
            interviewId: id,
            questionId: currentQuestion.id,
            bytes: recordedVideo.size,
            type: recordedVideo.type,
          })
        } else {
          console.warn('[InterviewMedia] video_blob_empty', {
            interviewId: id,
            questionId: currentQuestion.id,
          })
        }
      } catch (recErr) {
        console.warn('[InterviewMedia] Video stop error:', recErr)
      }
    }

    let currentAudio = audioBlob
    if (audioRecorderRef.current && isMediaRecording) {
      try {
        const recordedAudio = await audioRecorderRef.current.stopAndGetBlob()
        if (recordedAudio && recordedAudio.size > 0) {
          currentAudio = recordedAudio
        }
      } catch (recErr) {
        console.warn('[Interview] Audio stop error:', recErr)
      }
    }

    setIsMediaRecording(false)

    const textToSubmit = answer.trim()
    if (!textToSubmit) return

    setSubmitting(true)
    setError(null)
    setMediaNotice(null)

    try {
      const payload = {
        questionId: currentQuestion.id,
        answerText: textToSubmit,
        responseType: 'text',
        code: null,
        language: null,
      }

      // Step 1: Submit text response to create MongoDB Response record
      const res = await authApi.post(`/api/interviews/${id}/responses`, payload)

      const responseId = res.data.response?.id
      const questionId = currentQuestion.id

      // Step 2 & 3 & 4: Upload and analyze media before advancing so final results include video metrics
      const mediaResults = await submitMedia(responseId, questionId, currentAudio, currentVideo)

      // If video was recorded but failed, display non-destructive notice without blocking
      if (currentVideo && mediaResults.video?.error) {
        setMediaNotice('Video analysis could not be completed. Your technical evaluation is still available.')
      }

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
        setCompleting(true)
        const reason = interviewData?.completionReason || 'all_questions_completed'
        console.log('[InterviewLifecycle] completion_request_start', { interviewId: id, reason })
        const compStart = performance.now()
        try {
          await authApi.post(`/api/interviews/${id}/complete`, {
            completionReason: reason,
          })
          console.log('[InterviewLifecycle] completion_success', {
            interviewId: id,
            durationMs: Math.round(performance.now() - compStart),
          })
        } catch (e) {
          console.warn('[InterviewLifecycle] completion_notice', e.message)
        }
        setIsComplete(true)
        setCurrentQuestion(null)
        console.log('[InterviewLifecycle] navigation_to_results', { interviewId: id })
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
        setCompleting(true)
        const reason = interviewData?.completionReason || 'all_questions_completed'
        console.log('[InterviewLifecycle] completion_request_start', { interviewId: id, reason: 'skipped_last' })
        const compStart = performance.now()
        try {
          await authApi.post(`/api/interviews/${id}/complete`, {
            completionReason: reason,
          })
          console.log('[InterviewLifecycle] completion_success', {
            interviewId: id,
            durationMs: Math.round(performance.now() - compStart),
          })
        } catch (e) {
          console.warn('[InterviewLifecycle] completion_notice', e.message)
        }
        setIsComplete(true)
        setCurrentQuestion(null)
        console.log('[InterviewLifecycle] navigation_to_results', { interviewId: id })
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
        console.log('[InterviewLifecycle] navigation_to_results', { interviewId: id })
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

    console.log('[InterviewLifecycle] completion_request_start', { interviewId: id, reason: 'user_ended' })
    const compStart = performance.now()
    try {
      await authApi.post(`/api/interviews/${id}/complete`, {
        completionReason: 'user_ended',
      })
      console.log('[InterviewLifecycle] completion_success', {
        interviewId: id,
        durationMs: Math.round(performance.now() - compStart),
      })
      console.log('[InterviewLifecycle] navigation_to_results', { interviewId: id })
      navigate(`/interview/${id}/results`)
    } catch (err) {
      console.warn('[InterviewLifecycle] completion_error', err.message)
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
      <InterviewLoadingScreen
        onRetry={() => {
          startedRef.current = null
          setError(null)
          setLoading(true)
          window.location.reload()
        }}
      />
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
        onEndInterview={() => setShowEndConfirm(true)}
        onBrandClick={() => navigate('/dashboard')}
        questionNumber={Math.min(currentQIndex + 1, totalQ)}
        totalQuestions={totalQ}
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

      {/* ── Draggable Floating Video Window (Global Viewport Clamped) ─────── */}
      <FloatingVideoWindow
        userName={user?.fullName || user?.firstName || 'Candidate'}
        videoEnabled={videoEnabled}
        onToggleVideo={handleToggleVideo}
        isMicActive={isMicActive}
        onToggleMic={handleToggleMic}
        isRecording={isMediaRecording && videoEnabled}
        onVideoBlob={(blob) => setVideoBlob(blob)}
        videoRecorderRef={videoRecorderRef}
        disabled={submitting || skipping || completing}
      />

      {/* ── Main Focused Interview Workspace (Two-Column Responsive Layout) ── */}
      <main className="interview-workspace-main">
        <div className="interview-workspace-container">
          <div className="interview-workspace-columns">
            {/* ── LEFT COLUMN (~70–75% width): Question, Answer Card, Action Bar, Previous Feedback ── */}
            <div className="workspace-left-column">
              {/* 1. Question Card (text is protected on the right for floating video) */}
              <QuestionCard
                question={currentQuestion}
                questionNumber={Math.min(currentQIndex + 1, totalQ)}
                totalQuestions={totalQ}
              />

              {/* 2. Large Answer Card + Dedicated Action Bar below it */}
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

              {/* Media Notice Banner (Non-destructive) */}
              {mediaNotice && (
                <div
                  className="interview-notice-banner animate-fade-in"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '8px',
                    color: '#fbbf24',
                    fontSize: '13px',
                    margin: '8px 0',
                  }}
                >
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{mediaNotice}</span>
                </div>
              )}

              {/* 3. Previous Response Feedback (BELOW Action Bar in normal document flow) */}
              {lastEval && showLastEval && (
                <div className="previous-eval-card glass-card animate-fade-in">
                  <div className="previous-eval-header">
                    <div className="eval-status-left">
                      <ShieldCheck size={16} className="eval-success-icon" />
                      <span className="eval-card-title">Previous Response Feedback</span>
                    </div>
                    <div className="eval-tag-group">
                      <span className="eval-score-badge">
                        Score: {lastEval.textEvaluation?.textScore ?? lastEval.evaluation?.score ?? '—'}/100
                      </span>
                      <button
                        type="button"
                        className="btn-eval-dismiss"
                        onClick={() => setShowLastEval(false)}
                        title="Dismiss feedback"
                        aria-label="Dismiss feedback"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  {lastEval.textEvaluation?.strengths?.length > 0 && (
                    <div className="eval-concepts-row">
                      <span className="concepts-label">Covered Strengths:</span>
                      <div className="concept-tags-list">
                        {lastEval.textEvaluation.strengths.slice(0, 4).map((s, i) => (
                          <span key={i} className="concept-chip concept-covered">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {lastEval.textEvaluation?.missingConcepts?.length > 0 && (
                    <div className="eval-concepts-row">
                      <span className="concepts-label">Suggested Focus:</span>
                      <div className="concept-tags-list">
                        {lastEval.textEvaluation.missingConcepts.slice(0, 4).map((c, i) => (
                          <span key={i} className="concept-chip concept-missing">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(lastEval.textEvaluation?.feedback || lastEval.evaluation?.feedback) && (
                    <div className="eval-feedback-block">
                      <p className="eval-feedback-paragraph">
                        {lastEval.textEvaluation?.feedback || lastEval.evaluation?.feedback}
                      </p>
                    </div>
                  )}

                  {lastEval.textEvaluation?.improvementSuggestion && (
                    <div className="eval-improvement-row">
                      <Sparkles size={13} className="improvement-sparkle-icon" />
                      <span>{lastEval.textEvaluation.improvementSuggestion}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN (~25–30% width): Live Evaluation, Session Status, Guidelines ── */}
            <div className="workspace-right-column">
              <InterviewSidebar
                lastEval={lastEval}
                submitting={submitting}
                videoEnabled={videoEnabled}
                isMicActive={isMicActive}
                isListening={isListening}
                targetSkill={currentQuestion?.targetSkill || currentQuestion?.skill}
              />
            </div>
          </div>
        </div>
      </main>

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
    </div>
  )
}
