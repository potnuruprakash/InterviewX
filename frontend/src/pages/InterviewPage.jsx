import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthApi } from '../services/api'
import {
  Send, Brain, Clock, Tag, BarChart2, AlertCircle,
  ChevronRight, Mic, Video, CheckCircle, Loader2, Info,
  TrendingUp, Zap, BookOpen
} from 'lucide-react'
import AudioRecorder from '../components/AudioRecorder'
import VideoRecorder from '../components/VideoRecorder'
import './InterviewPage.css'

const CATEGORY_COLORS = {
  technical: 'badge-purple',
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
  project: '🏗️',
  experience: '💼',
  behavioral: '🤝',
  job_specific: '🎯',
  skill_gap: '📊',
  follow_up: '↩️',
}

export default function InterviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { authApi, isLoaded, isSignedIn } = useAuthApi()

  const [interview, setInterview] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [lastEval, setLastEval] = useState(null)
  const [isComplete, setIsComplete] = useState(false)
  const [timer, setTimer] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)
  const [videoBlob, setVideoBlob] = useState(null)
  const [mediaSubmitting, setMediaSubmitting] = useState(false)
  const [lastResponse, setLastResponse] = useState(null)
  const [showModalities, setShowModalities] = useState(false)

  const timerRef = useRef(null)
  const textareaRef = useRef(null)
  const startedRef = useRef(null)

  // Timer per question
  useEffect(() => {
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [currentQuestion?.id])

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // Start interview
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
        setInterview(res.data.interview)
        setCurrentQuestion(res.data.currentQuestion)
        setIsComplete(res.data.interview.status === 'completed')
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id, isLoaded, isSignedIn])

  const handleAudioRecorded = useCallback((blob) => {
    setAudioBlob(blob)
  }, [])

  const handleVideoRecorded = useCallback((blob) => {
    setVideoBlob(blob)
  }, [])

  const submitMedia = async (responseId, questionId) => {
    const promises = []

    if (audioBlob) {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('responseId', responseId)
      formData.append('questionId', questionId)
      promises.push(
        authApi.post(`/api/interviews/${id}/audio-response`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }).catch((e) => console.warn('[Interview] Audio submit failed:', e.message))
      )
    }

    if (videoBlob) {
      const formData = new FormData()
      formData.append('video', videoBlob, 'recording.webm')
      formData.append('responseId', responseId)
      formData.append('questionId', questionId)
      promises.push(
        authApi.post(`/api/interviews/${id}/video-response`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }).catch((e) => console.warn('[Interview] Video submit failed:', e.message))
      )
    }

    if (promises.length > 0) {
      setMediaSubmitting(true)
      await Promise.all(promises).finally(() => setMediaSubmitting(false))
    }
  }

  const handleSubmit = async () => {
    if (!answer.trim() || !currentQuestion) return
    setSubmitting(true)
    setError(null)
    setTimer(0)
    clearInterval(timerRef.current)

    try {
      const res = await authApi.post(`/api/interviews/${id}/responses`, {
        questionId: currentQuestion.id,
        answerText: answer.trim(),
      })

      const responseId = res.data.response?.id
      const questionId = currentQuestion.id

      // Submit audio/video in background (non-blocking for interview flow)
      submitMedia(responseId, questionId)

      setLastEval(res.data.response)
      setLastResponse(res.data.response)
      setAnswer('')
      setAudioBlob(null)
      setVideoBlob(null)
      setInterview(res.data.interview)

      if (res.data.interview.isComplete) {
        setIsComplete(true)
        setCurrentQuestion(null)
      } else {
        setCurrentQuestion(res.data.nextQuestion)
        timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
  }

  const handleEndInterview = async () => {
    if (!window.confirm('End interview now? This will complete the session.')) return
    try {
      await authApi.post(`/api/interviews/${id}/complete`)
      navigate(`/interview/${id}/results`)
    } catch (err) {
      setError(err.message)
    }
  }

  const progress = interview
    ? Math.round((interview.currentQuestionIndex / interview.totalQuestions) * 100)
    : 0

  if (loading) {
    return (
      <div className="interview-loading">
        <div className="loading-spinner">
          <Brain size={32} className="loading-icon" />
          <div className="spinner" />
        </div>
        <p>Preparing your personalized interview...</p>
      </div>
    )
  }

  if (isComplete) {
    return (
      <div className="interview-complete">
        <div className="complete-card glass-card">
          <div className="complete-icon">🎉</div>
          <h1 className="complete-title">Interview Complete!</h1>
          <p className="complete-subtitle">
            You answered {interview?.totalQuestions ?? interview?.currentQuestionIndex} questions.
            {mediaSubmitting && ' Audio/video is still uploading...'}
          </p>
          {mediaSubmitting && <div className="media-uploading"><div className="spinner" /> Uploading audio/video...</div>}
          <div className="complete-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate(`/interview/${id}/results`)}>
              View Results <ChevronRight size={18} />
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="interview-page">
      {/* Top Bar */}
      <div className="interview-topbar">
        <div className="interview-topbar-inner">
          <div className="topbar-left">
            <div className="interview-brand">
              <Brain size={20} />
              <span>InterviewX</span>
            </div>
            {interview && (
              <div className="interview-meta-badges">
                <span className="badge badge-purple">{interview.interviewType}</span>
                <span className={`badge ${DIFFICULTY_COLORS[interview.difficulty]}`}>
                  {interview.interviewType === 'adaptive' || interview.currentDifficulty
                    ? interview.interviewState?.currentDifficulty || interview.difficulty
                    : interview.difficulty}
                </span>
                {interview.questionGenerationSource === 'personalized' && (
                  <span className="badge badge-cyan" title="Questions generated from your resume + JD">
                    ✨ Personalized
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="topbar-right">
            {interview && (
              <span className="question-progress-text">
                Q{Math.min(interview.currentQuestionIndex + 1, interview.totalQuestions)} / {interview.totalQuestions}
              </span>
            )}
            <div className="timer-badge">
              <Clock size={14} />
              <span>{formatTime(timer)}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleEndInterview} title="End interview">
              End
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Main Layout */}
      <div className="interview-layout container">
        {/* Question Panel */}
        <div className="question-panel">
          {currentQuestion ? (
            <div className="question-card glass-card animate-fade-in" key={currentQuestion.id}>
              {/* Question Header */}
              <div className="question-header">
                <div className="question-number">
                  {TYPE_ICONS[currentQuestion.type] || '❓'} Q{(interview?.currentQuestionIndex ?? 0) + 1}
                </div>
                <div className="question-badges">
                  <span className={`badge ${CATEGORY_COLORS[currentQuestion.category] || 'badge-gray'}`}>
                    <Tag size={10} /> {currentQuestion.category}
                  </span>
                  <span className={`badge ${DIFFICULTY_COLORS[currentQuestion.difficulty]}`}>
                    {currentQuestion.difficulty}
                  </span>
                  {currentQuestion.targetSkill && currentQuestion.targetSkill !== 'general' && (
                    <span className="badge badge-gray">{currentQuestion.targetSkill}</span>
                  )}
                </div>
              </div>

              {/* Context note for skill-gap questions */}
              {currentQuestion.contextNote && (
                <div className="context-note">
                  <Info size={12} />
                  <span>{currentQuestion.contextNote}</span>
                </div>
              )}

              {/* Question Text */}
              <p className="question-text">{currentQuestion.text}</p>

              {/* Source badge */}
              {currentQuestion.source && currentQuestion.source !== 'static_bank' && (
                <div className="question-source">
                  {currentQuestion.source === 'resume' && <><BookOpen size={11} /> From your resume</>}
                  {currentQuestion.source === 'job_description' && <><Zap size={11} /> From job description</>}
                  {currentQuestion.source === 'skill_gap' && <><BarChart2 size={11} /> Skill gap assessment</>}
                  {currentQuestion.source === 'experience' && <><TrendingUp size={11} /> Experience-based</>}
                  {currentQuestion.source === 'behavioral' && <><CheckCircle size={11} /> Behavioral</>}
                </div>
              )}

              {/* Tips */}
              <div className="question-tip">
                💡 Press <kbd>Ctrl+Enter</kbd> to submit · Be specific and use examples
              </div>
            </div>
          ) : (
            <div className="question-card glass-card">
              <p className="text-secondary">Loading question...</p>
            </div>
          )}

          {/* Previous Answer Evaluation */}
          {lastEval && (
            <div className="eval-feedback glass-card animate-fade-in">
              <div className="eval-header">
                <CheckCircle size={16} className="eval-icon" />
                <span>Previous Answer Evaluated</span>
                {lastEval.textEvaluation?.modelStatus === 'sbert_evaluated' ? (
                  <span className="badge badge-green" style={{ fontSize: '10px' }}>SBERT</span>
                ) : (
                  <span className="badge badge-dev" style={{ fontSize: '10px' }}>Dev Fallback</span>
                )}
              </div>

              <div className="eval-score-row">
                <span className="eval-score-label">Text Score</span>
                <span className="eval-score-value">
                  {lastEval.textEvaluation?.textScore ?? lastEval.evaluation?.score ?? '—'}/100
                </span>
              </div>

              {lastEval.textEvaluation?.semanticScore !== null && lastEval.textEvaluation?.semanticScore !== undefined && (
                <div className="eval-sub-scores">
                  <div className="sub-score">
                    <span>Semantic</span>
                    <span>{Math.round(lastEval.textEvaluation.semanticScore)}</span>
                  </div>
                  <div className="sub-score">
                    <span>Concept Coverage</span>
                    <span>{Math.round(lastEval.textEvaluation.conceptCoverage)}</span>
                  </div>
                </div>
              )}

              {lastEval.textEvaluation?.strengths?.length > 0 && (
                <div className="eval-section">
                  <span className="eval-section-label">✅ Strengths</span>
                  <div className="concept-tags">
                    {lastEval.textEvaluation.strengths.slice(0, 3).map((s, i) => (
                      <span key={i} className="concept-tag concept-covered">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {lastEval.textEvaluation?.missingConcepts?.length > 0 && (
                <div className="eval-section">
                  <span className="eval-section-label">⚠️ Missed Concepts</span>
                  <div className="concept-tags">
                    {lastEval.textEvaluation.missingConcepts.slice(0, 3).map((c, i) => (
                      <span key={i} className="concept-tag concept-missing">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {(lastEval.textEvaluation?.feedback || lastEval.evaluation?.feedback) && (
                <p className="eval-feedback-text">
                  {lastEval.textEvaluation?.feedback || lastEval.evaluation?.feedback}
                </p>
              )}

              {(lastEval.textEvaluation?.improvementSuggestion) && (
                <p className="eval-suggestion">
                  💡 {lastEval.textEvaluation.improvementSuggestion}
                </p>
              )}

              {lastEval.evaluation?.isDevelopmentEvaluation && (
                <div className="dev-notice" style={{ marginTop: 8 }}>
                  {lastEval.evaluation.notice}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Answer Panel */}
        <div className="answer-panel">
          {/* Modality Toggles */}
          <div className="modality-bar">
            <button
              className={`modality-toggle ${showModalities ? 'active' : ''}`}
              onClick={() => setShowModalities((v) => !v)}
              title="Toggle audio/video recording"
            >
              <Mic size={14} />
              <Video size={14} />
              <span>Audio/Video</span>
              {(audioBlob || videoBlob) && <span className="modality-dot" />}
            </button>
            {interview?.modalityAvailability?.audio && (
              <span className="badge badge-green" style={{ fontSize: '10px' }}>Audio ✓</span>
            )}
            {interview?.modalityAvailability?.video && (
              <span className="badge badge-green" style={{ fontSize: '10px' }}>Video ✓</span>
            )}
          </div>

          {/* Audio/Video Recording (collapsible) */}
          {showModalities && (
            <div className="media-recorders animate-fade-in">
              <AudioRecorder onRecordingComplete={handleAudioRecorded} disabled={submitting} />
              <VideoRecorder onRecordingComplete={handleVideoRecorded} disabled={submitting} />
              <p className="media-note">
                Audio/video are optional. Your text answer is always saved regardless.
              </p>
            </div>
          )}

          {/* Text Answer Area */}
          <div className="answer-box glass-card">
            <div className="answer-box-header">
              <span className="answer-box-label">Your Answer</span>
              <div className="answer-meta">
                {(audioBlob || videoBlob) && (
                  <span className="media-attached">
                    {audioBlob && '🎤'}{videoBlob && '📹'} attached
                  </span>
                )}
                <span className="word-count">
                  {answer.trim() ? answer.trim().split(/\s+/).length : 0} words
                </span>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              className="answer-textarea"
              placeholder="Type your answer here... Be specific, use examples, and structure your response clearly."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={submitting || !currentQuestion}
              rows={10}
            />

            {error && (
              <div className="error-notice">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button
              className="btn btn-primary submit-btn"
              onClick={handleSubmit}
              disabled={!answer.trim() || submitting || !currentQuestion}
              id="submit-answer-btn"
            >
              {submitting
                ? <><span className="spinner" /> Evaluating...</>
                : <><Send size={16} /> Submit Answer (Ctrl+Enter)</>}
            </button>

            {mediaSubmitting && (
              <div className="media-uploading">
                <Loader2 size={12} className="spin" /> Uploading media...
              </div>
            )}
          </div>

          {/* Analysis Pipeline Status */}
          <div className="phase-info glass-card">
            <div className="phase-info-title">📊 Analysis Pipeline</div>
            <div className="phase-item active">
              <span className="phase-dot active-dot" />
              <span>Text Analysis (SBERT)</span>
              <span className="badge badge-green">Active</span>
            </div>
            <div className={`phase-item ${showModalities ? 'active' : ''}`}>
              <span className={`phase-dot ${showModalities ? 'active-dot' : ''}`} />
              <span>Audio Analysis (MFCC)</span>
              <span className={`badge ${showModalities ? 'badge-yellow' : 'badge-gray'}`}>
                {showModalities ? 'Optional' : 'Enable Above'}
              </span>
            </div>
            <div className={`phase-item ${showModalities ? 'active' : ''}`}>
              <span className={`phase-dot ${showModalities ? 'active-dot' : ''}`} />
              <span>Video Analysis (YOLOv8)</span>
              <span className={`badge ${showModalities ? 'badge-yellow' : 'badge-gray'}`}>
                {showModalities ? 'Optional' : 'Enable Above'}
              </span>
            </div>
            <div className="phase-item">
              <span className="phase-dot" />
              <span>Multimodal Fusion</span>
              <span className="badge badge-gray">On Submit</span>
            </div>
          </div>

          {/* Adaptive Engine Status */}
          {interview?.interviewState?.currentDifficulty && (
            <div className="adaptive-status glass-card">
              <div className="adaptive-title">⚡ Adaptive Engine</div>
              <div className="adaptive-row">
                <span>Current Difficulty</span>
                <span className={`badge ${DIFFICULTY_COLORS[interview.interviewState.currentDifficulty]}`}>
                  {interview.interviewState.currentDifficulty}
                </span>
              </div>
              {interview.interviewState.strongAreas?.length > 0 && (
                <div className="adaptive-row">
                  <span>Strong</span>
                  <span className="skill-list green">
                    {interview.interviewState.strongAreas.slice(0, 2).join(', ')}
                  </span>
                </div>
              )}
              {interview.interviewState.weakAreas?.length > 0 && (
                <div className="adaptive-row">
                  <span>Developing</span>
                  <span className="skill-list yellow">
                    {interview.interviewState.weakAreas.slice(0, 2).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
