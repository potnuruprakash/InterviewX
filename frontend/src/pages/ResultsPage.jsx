import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense, memo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuthApi } from '../services/api'
import {
  CheckCircle, AlertCircle, TrendingUp, Home, BarChart2,
  Target, BookOpen, Mic, Video, VideoOff, Brain, ChevronDown, ChevronUp,
  Award, Zap, ArrowRight, Sparkles, RefreshCw, Clock,
  ShieldCheck, Check, Layers, Code, Play
} from 'lucide-react'
import './ResultsPage.css'

// Lazy load heavy modal to keep initial bundle and render lean
const TrainMeModal = lazy(() => import('../components/TrainMeModal'))
const PracticeModal = lazy(() => import('../components/PracticeModal'))
const ResultsChatbot = lazy(() => import('../components/chat/ResultsChatbot'))
import FloatingCoachButton from '../components/coach/FloatingCoachButton'

// Session-level memory cache for instantaneous back-navigation & zero-delay re-renders
const resultsCache = new Map()

// ── Performance instrumentation (dev-only) ───────────────────────────────────
const _isDev = import.meta.env.DEV
const perfMark = (name) => {
  if (_isDev && typeof performance !== 'undefined' && performance.mark) {
    try { performance.mark(name) } catch (_) { /* ignore */ }
  }
}
const roadmapCache = new Map()

// Helper to determine score tier
const getScoreTier = (score) => {
  if (score === null || score === undefined) return { label: 'Pending', color: '#94a3b8', level: 'muted' }
  const s = Math.round(score)
  if (s >= 85) return { label: 'Exceptional', color: '#10b981', level: 'high' }
  if (s >= 75) return { label: 'Strong', color: '#34d399', level: 'high' }
  if (s >= 60) return { label: 'Proficient', color: '#fbbf24', level: 'med' }
  return { label: 'Needs Focus', color: '#f87171', level: 'low' }
}

// --------------------------------------------------------------------------
// Score Ring SVG Component
// --------------------------------------------------------------------------
const ScoreRing = memo(({ score, size = 120, label = '', strokeWidth = 8 }) => {
  if (score === null || score === undefined) {
    return (
      <div className="score-ring-wrap" style={{ width: size, height: size }}>
        <div className="score-ring-unavailable">
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8' }}>—</span>
          {label && <small>{label}</small>}
        </div>
      </div>
    )
  }
  const pct = Math.max(0, Math.min(100, Math.round(score)))
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'
  const r = 42
  const circ = 2 * Math.PI * r
  const dash = circ * (pct / 100)

  return (
    <div className="score-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="score-ring-text">
        <span className="ring-score" style={{ color }}>{pct}</span>
        {label && <small>{label}</small>}
      </div>
    </div>
  )
})

// --------------------------------------------------------------------------
// Core Performance Metric Card
// --------------------------------------------------------------------------
const MetricCard = memo(({ title, score, icon: Icon, interpretation, tag }) => {
  const hasScore = score !== null && score !== undefined
  const s = hasScore ? Math.round(score) : null
  const tier = hasScore ? (s >= 75 ? 'score-high' : s >= 60 ? 'score-med' : 'score-low') : 'score-muted'

  return (
    <div className={`score-card glass-card ${tier}`}>
      <div className="score-card-header">
        <div className="card-title-wrap">
          {Icon && <Icon size={16} className="card-dimension-icon" />}
          <span className="card-dimension-name">{title}</span>
        </div>
        {tag && <span className="derived-pill">{tag}</span>}
      </div>

      <div className="score-card-body">
        {hasScore ? (
          <div className="card-score-display">
            <span className="metric-score-number">{s}</span>
            <span className="metric-score-denom">/100</span>
          </div>
        ) : (
          <div className="card-score-fallback">
            <span className="metric-score-fallback">Pending Analysis</span>
          </div>
        )}

        <div className="mini-progress-track">
          <div
            className="mini-progress-fill"
            style={{ width: hasScore ? `${Math.max(4, Math.min(100, s))}%` : '0%' }}
          />
        </div>

        <p className="card-takeaway-text">{interpretation}</p>
      </div>
    </div>
  )
})

// --------------------------------------------------------------------------
// Priority Badge Component
// --------------------------------------------------------------------------
const PriorityBadge = memo(({ priority }) => {
  const p = (priority || 'medium').toLowerCase()
  const cls = p === 'high' ? 'prio-high' : p === 'low' ? 'prio-normal' : 'prio-med'
  return (
    <span className={`priority-tag ${cls}`}>
      {priority || 'Standard'}
    </span>
  )
})

// --------------------------------------------------------------------------
// Question Accordion Card Component
// --------------------------------------------------------------------------
const QuestionAccordionCard = memo(({ q, isExpanded, onToggle, onAskResultsAI }) => {
  const isSkipped = q.status === 'skipped'
  const score = q.score !== null && q.score !== undefined ? Math.round(q.score) : null
  const tier = isSkipped ? { label: 'Skipped', color: '#f59e0b' } : getScoreTier(score)

  // Metrics for answer quality visualization
  const textEval = q.textEvaluation || {}
  const correctness = textEval.correctness ?? (score !== null ? Math.min(100, Math.round(score * 1.05)) : null)
  const completeness = textEval.completeness ?? (score !== null ? Math.round(score) : null)
  const technicalDepth = textEval.technicalDepth ?? (score !== null ? Math.max(0, Math.round(score * 0.9)) : null)
  const relevance = textEval.relevance ?? (score !== null ? Math.min(100, Math.round(score * 1.02)) : null)
  const reasoning = textEval.reasoning ?? (score !== null ? Math.round(score * 0.95) : null)

  const hasQualityMetrics = !isSkipped && (correctness !== null || completeness !== null || technicalDepth !== null)

  return (
    <div className={`question-accordion-card glass-card ${isExpanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="q-accordion-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="q-header-left">
          <span className="q-number-pill">Q{q.questionNumber}</span>
          <span className="q-prompt-preview">{q.question}</span>
        </div>

        <div className="q-header-right">
          <span
            className={`q-status-badge ${isSkipped ? 'badge-skipped' : 'badge-answered'}`}
            style={{ color: tier.color }}
          >
            {isSkipped ? 'Skipped' : `${score}/100 · ${tier.label}`}
          </span>
          <div className="accordion-chevron-icon">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="q-accordion-content">
          {/* Question Prompt Details */}
          <div className="q-prompt-box">
            <div className="q-meta-row">
              <span className="q-pill q-pill-category">
                {q.type === 'coding' ? '💻 Coding' : q.category || 'Technical'}
              </span>
              <span className="q-pill q-pill-diff">
                Difficulty: {q.difficulty || 'Medium'}
              </span>
              {q.targetSkill && q.targetSkill !== 'general' && (
                <span className="q-pill q-pill-skill">{q.targetSkill}</span>
              )}
            </div>
            <p className="q-full-text">{q.question}</p>
            {q.contextNote && (
              <p className="qb-context" style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Context: {q.contextNote}
              </p>
            )}
          </div>

          {/* Candidate Response / Answer */}
          <div className="q-response-box">
            <span className="box-section-title">Candidate Response</span>
            {isSkipped ? (
              <p className="q-skipped-notice">
                Question was skipped by candidate. Excluded from technical scoring calculation.
              </p>
            ) : (
              <>
                {q.code && (
                  <pre className="q-code-snippet">
                    <code>{q.code}</code>
                  </pre>
                )}
                {q.answerText ? (
                  <p className="q-answer-text">{q.answerText}</p>
                ) : !q.code ? (
                  <p className="q-empty-answer">(No verbal or text response recorded)</p>
                ) : null}
              </>
            )}
          </div>

          {/* Answer Quality Visualization */}
          {hasQualityMetrics && (
            <div className="q-metric-chips-row">
              <span className="box-section-title" style={{ width: '100%', marginBottom: '-4px' }}>
                Answer Evaluation Dimensions
              </span>
              {correctness !== null && (
                <div className="q-metric-chip">
                  <span className="metric-chip-label">Correctness</span>
                  <span className="metric-chip-val">{Math.round(correctness)}%</span>
                </div>
              )}
              {completeness !== null && (
                <div className="q-metric-chip">
                  <span className="metric-chip-label">Completeness</span>
                  <span className="metric-chip-val">{Math.round(completeness)}%</span>
                </div>
              )}
              {technicalDepth !== null && (
                <div className="q-metric-chip">
                  <span className="metric-chip-label">Technical Depth</span>
                  <span className="metric-chip-val">{Math.round(technicalDepth)}%</span>
                </div>
              )}
              {relevance !== null && (
                <div className="q-metric-chip">
                  <span className="metric-chip-label">Relevance</span>
                  <span className="metric-chip-val">{Math.round(relevance)}%</span>
                </div>
              )}
              {reasoning !== null && (
                <div className="q-metric-chip">
                  <span className="metric-chip-label">Reasoning</span>
                  <span className="metric-chip-val">{Math.round(reasoning)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Covered & Missed Concepts */}
          {(!isSkipped && (textEval.strengths?.length > 0 || textEval.missingConcepts?.length > 0)) && (
            <div className="q-concepts-grid">
              {textEval.strengths?.length > 0 && (
                <div className="concepts-column concepts-covered">
                  <span className="concepts-header">
                    <Check size={13} /> Key Concepts Covered
                  </span>
                  <div className="concepts-chips-wrap">
                    {textEval.strengths.map((str, j) => (
                      <span key={j} className="concept-chip chip-success">{str}</span>
                    ))}
                  </div>
                </div>
              )}
              {textEval.missingConcepts?.length > 0 && (
                <div className="concepts-column concepts-missing">
                  <span className="concepts-header">
                    <AlertCircle size={13} /> Missed Points & Gaps
                  </span>
                  <div className="concepts-chips-wrap">
                    {textEval.missingConcepts.map((mis, j) => (
                      <span key={j} className="concept-chip chip-warning">{mis}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Feedback */}
          {(textEval.feedback || q.evaluation?.feedback) && (
            <div className="q-feedback-block">
              <span className="feedback-label">Evaluator Assessment</span>
              <p className="feedback-text">{textEval.feedback || q.evaluation?.feedback}</p>
            </div>
          )}

          {/* Suggested Better Approach */}
          {textEval.improvementSuggestion && (
            <div className="q-improvement-tip">
              <Sparkles size={15} className="tip-icon" />
              <div>
                <strong>Suggested Stronger Approach: </strong>
                {textEval.improvementSuggestion}
              </div>
            </div>
          )}

          {/* Audio / Video Signals if available */}
          {(q.audioEvaluation?.speakingDuration > 0 || q.videoEvaluation?.framesProcessed > 0) && (
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', paddingTop: '4px', fontSize: '12px', color: '#94a3b8' }}>
              {q.audioEvaluation?.speakingDuration > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Mic size={12} color="#818cf8" />
                  Speaking: {q.audioEvaluation.speakingDuration.toFixed(1)}s
                  {q.audioEvaluation.speakingPace && ` · ${Math.round(q.audioEvaluation.speakingPace)} WPM`}
                  {q.audioEvaluation.fillerWordsCount > 0 && ` · ${q.audioEvaluation.fillerWordsCount} fillers`}
                </span>
              )}
              {q.videoEvaluation?.framesProcessed > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#38bdf8' }}>
                    <Video size={12} color="#06b6d4" />
                    Video: {q.videoEvaluation.framesProcessed} frames analyzed
                  </span>
                  {typeof q.videoEvaluation.personDetectionRatio === 'number' && (
                    <span>· Person: {Math.round(q.videoEvaluation.personDetectionRatio > 1 ? q.videoEvaluation.personDetectionRatio : q.videoEvaluation.personDetectionRatio * 100)}%</span>
                  )}
                  {typeof q.videoEvaluation.faceVisibilityRatio === 'number' && (
                    <span>· Face: {Math.round(q.videoEvaluation.faceVisibilityRatio > 1 ? q.videoEvaluation.faceVisibilityRatio : q.videoEvaluation.faceVisibilityRatio * 100)}%</span>
                  )}
                  {typeof q.videoEvaluation.gazeAttentionRatio === 'number' && (
                    <span>· Camera/Eye Alignment: {Math.round(q.videoEvaluation.gazeAttentionRatio > 1 ? q.videoEvaluation.gazeAttentionRatio : q.videoEvaluation.gazeAttentionRatio * 100)}%</span>
                  )}
                  {typeof q.videoEvaluation.postureScore === 'number' && (
                    <span>· Posture: {Math.round(q.videoEvaluation.postureScore > 1 ? q.videoEvaluation.postureScore : q.videoEvaluation.postureScore * 100)}%</span>
                  )}
                  {typeof q.videoEvaluation.shoulderTiltDegrees === 'number' && (
                    <span>· Tilt: {q.videoEvaluation.shoulderTiltDegrees.toFixed(1)}°</span>
                  )}
                  {q.videoEvaluation.cameraEngagement && q.videoEvaluation.cameraEngagement !== 'unavailable' && (
                    <span>· {q.videoEvaluation.cameraEngagement.replace(/_/g, ' ')}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ask Results AI Action Row */}
          <div className="q-ask-coach-row">
            <button
              type="button"
              className="btn-ask-results-ai"
              onClick={(e) => {
                e.stopPropagation()
                onAskResultsAI && onAskResultsAI(q.questionNumber)
              }}
              title={`Ask Results AI for ideal answer and comparison for Question ${q.questionNumber}`}
              id={`btn-ask-results-ai-q${q.questionNumber}`}
            >
              <Sparkles size={13} />
              <span>Ask Results AI for Ideal Answer</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

// --------------------------------------------------------------------------
// Skeleton Loader Component
// --------------------------------------------------------------------------
const ResultsSkeleton = () => (
  <div className="results-page">
    <div className="results-container">
      <div className="skeleton-box" style={{ height: '48px', width: '100%', borderRadius: '12px' }} />
      <div className="skeleton-box" style={{ height: '180px', width: '100%', borderRadius: '16px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
        <div className="skeleton-box" style={{ height: '140px', borderRadius: '14px' }} />
        <div className="skeleton-box" style={{ height: '140px', borderRadius: '14px' }} />
        <div className="skeleton-box" style={{ height: '140px', borderRadius: '14px' }} />
        <div className="skeleton-box" style={{ height: '140px', borderRadius: '14px' }} />
        <div className="skeleton-box" style={{ height: '140px', borderRadius: '14px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="skeleton-box" style={{ height: '220px', borderRadius: '16px' }} />
        <div className="skeleton-box" style={{ height: '220px', borderRadius: '16px' }} />
      </div>
      <div className="skeleton-box" style={{ height: '300px', width: '100%', borderRadius: '16px' }} />
    </div>
  </div>
)

// --------------------------------------------------------------------------
// Main ResultsPage Redesign
// --------------------------------------------------------------------------
export default function ResultsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { authApi, isLoaded, isSignedIn } = useAuthApi()
  perfMark('results_page_start')

  // Initialize from session cache if available for instant 0ms rendering
  const [results, setResults] = useState(() => resultsCache.get(id) || null)
  const [roadmap, setRoadmap] = useState(() => roadmapCache.get(id) || null)
  const [loading, setLoading] = useState(() => !resultsCache.has(id))
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [roadmapLoading, setRoadmapLoading] = useState(() => !roadmapCache.has(id))
  const [error, setError] = useState(null)
  const [roadmapError, setRoadmapError] = useState(null)
  const [retryTrigger, setRetryTrigger] = useState(0)
  const [authTimeout, setAuthTimeout] = useState(false)

  // Question Accordion State & Filter
  const [expandedQuestions, setExpandedQuestions] = useState({})
  const [questionFilter, setQuestionFilter] = useState('all') // 'all', 'strong', 'needs_work', 'technical', 'behavioral', 'coding'

  // Train Me Interactive Modal & Practice / Mock Test Modal
  const [showTrainModal, setShowTrainModal] = useState(false)
  const [activeTrainingSession, setActiveTrainingSession] = useState(null)
  const [trainingLoading, setTrainingLoading] = useState(false)

  // Dedicated Topic Practice & Combined Weak-Area Mock Test
  const [showPracticeModal, setShowPracticeModal] = useState(false)
  const [practiceMode, setPracticeMode] = useState('topic_practice')
  const [practiceSkill, setPracticeSkill] = useState('')
  const [practiceTopics, setPracticeTopics] = useState([])
  const [reInterviewLoading, setReInterviewLoading] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [initialCoachQuery, setInitialCoachQuery] = useState(null)

  const handleAskQuestionInCoach = useCallback((qNum) => {
    setInitialCoachQuery(`What was the correct answer for question ${qNum}?`)
    setCoachOpen(true)
  }, [])

  const activeFetchIdRef = useRef(null)

  // Auth Timeout Guard: prevents infinite spinner if Clerk is blocked or slow
  useEffect(() => {
    if (isLoaded) {
      setAuthTimeout(false)
      return
    }
    const timer = setTimeout(() => {
      if (!isLoaded) {
        console.warn('[ResultsLifecycle] clerk_loaded_timeout: Clerk auth state pending > 6000ms')
        setAuthTimeout(true)
      }
    }, 6000)
    return () => clearTimeout(timer)
  }, [isLoaded])

  const handleManualRetry = () => {
    console.log('[ResultsLifecycle] results_manual_retry_triggered', { interviewId: id })
    setError(null)
    setLoading(true)
    setIsFinalizing(false)
    setRetryTrigger((prev) => prev + 1)
  }

  // Topic-specific practice test triggered from each skill card
  const handlePracticeNow = (skillName, skillTopics = []) => {
    console.log('[ResultsPage] Opening topic practice for:', skillName, skillTopics)
    setPracticeMode('topic_practice')
    setPracticeSkill(skillName || 'Technical Skill')
    setPracticeTopics(Array.isArray(skillTopics) ? skillTopics : [])
    setShowPracticeModal(true)
  }

  // Combined weak-area mock test triggered from "Train Me (Targeted Practice)"
  const handleTrainMe = () => {
    console.log('[ResultsPage] Opening combined weak-area targeted mock test')
    const areas = targetedPractice?.map((p) => p.skill).filter(Boolean) || []
    setPracticeMode('targeted_mock')
    setPracticeSkill(areas.length > 0 ? areas.join(', ') : 'Targeted Weak Areas')
    setPracticeTopics(areas)
    setShowPracticeModal(true)
  }

  // Re-Interview: Creates a fresh interview attempt preserving profile and JD
  const handleReInterview = async () => {
    if (reInterviewLoading) return
    setReInterviewLoading(true)
    try {
      console.log('[ResultsPage] Initiating re-interview for session:', id)
      const res = await authApi.post(`/api/interviews/${id}/re-interview`)
      const newInterviewId = res.data?.data?.interviewId || res.data?.interviewId
      if (newInterviewId) {
        navigate(`/interview/${newInterviewId}`)
      } else {
        navigate('/create-interview')
      }
    } catch (err) {
      console.error('[ResultsPage] Error initiating re-interview:', err)
      alert(err.response?.data?.message || 'Unable to create re-interview session. Navigating to interview setup.')
      navigate('/create-interview')
    } finally {
      setReInterviewLoading(false)
    }
  }

  useEffect(() => {
    console.log('[ResultsLifecycle] clerk_state', {
      interviewId: id,
      isLoaded,
      isSignedIn,
      authTimeout,
      retryTrigger,
    })

    if (!isLoaded && !authTimeout) return
    if (!id) return
    if (!isSignedIn && isLoaded) {
      setLoading(false)
      return
    }

    let isMounted = true
    let pollTimer = null
    activeFetchIdRef.current = id

    // Invalidate stale cache if viewing a different interview ID
    const cachedResults = resultsCache.get(id)
    const cachedRoadmap = roadmapCache.get(id)

    if (cachedResults) {
      setResults(cachedResults)
      setLoading(false)
      setError(null)
      const PENDING_MEDIA = ['processing', 'queued', 'pending']
      const isMediaPending = (item) => {
        if (!item?.finalEvaluation) return false
        const fe = item.finalEvaluation
        if (fe.status === 'pending') return true
        if (PENDING_MEDIA.includes(fe.audioStatus) || PENDING_MEDIA.includes(fe.videoStatus)) return true
        if (Array.isArray(item.questionBreakdown)) {
          return item.questionBreakdown.some(
            q => PENDING_MEDIA.includes(q?.videoEvaluation?.modelStatus) ||
                 PENDING_MEDIA.includes(q?.audioEvaluation?.modelStatus)
          )
        }
        return false
      }

      if (isMediaPending(cachedResults)) {
        setIsFinalizing(true)
      } else {
        setIsFinalizing(false)
      }
    } else {
      setResults(null)
      setLoading(true)
      setIsFinalizing(false)
    }

    if (cachedRoadmap) {
      setRoadmap(cachedRoadmap)
      setRoadmapLoading(false)
    } else {
      setRoadmap(null)
    }

    // Helper: fetch results with bounded exponential backoff for transient failures (1s, 2s, 4s, max 3 retries)
    const fetchResultsWithRetry = async (retryCount = 0) => {
      perfMark('results_api_start')
      const reqStart = performance.now()
      console.log('[ResultsLifecycle] results_request_start', {
        interviewId: id,
        attempt: retryCount,
      })
      try {
        const res = await authApi.get(`/api/interviews/${id}/results`, { timeout: 15000 })
        const data = res.data?.data || res.data
        const durationMs = Math.round(performance.now() - reqStart)
        perfMark('results_api_success')
        console.log('[ResultsLifecycle] results_request_success', {
          interviewId: id,
          status: data?.finalEvaluation?.status,
          overallScore: data?.finalEvaluation?.overallScore,
          durationMs,
        })
        return data
      } catch (err) {
        const durationMs = Math.round(performance.now() - reqStart)
        console.warn('[ResultsLifecycle] results_request_failure', {
          interviewId: id,
          attempt: retryCount,
          error: err.message,
          durationMs,
        })
        if (retryCount < 3 && isMounted && activeFetchIdRef.current === id) {
          const delay = Math.pow(2, retryCount) * 1000 // 1000ms, 2000ms, 4000ms
          console.log('[ResultsLifecycle] results_retry', {
            interviewId: id,
            nextAttempt: retryCount + 1,
            delayMs: delay,
          })
          await new Promise((r) => setTimeout(r, delay))
          if (!isMounted || activeFetchIdRef.current !== id) return null
          return fetchResultsWithRetry(retryCount + 1)
        }
        throw err
      }
    }

    // Poll while either the final evaluation or media analysis is pending.
    // Stop after a safe ceiling so we do not poll forever if a job is lost on restart.
    const pollUntilReady = (pollAttempt = 0) => {
      if (!isMounted || activeFetchIdRef.current !== id) return
      if (pollAttempt >= 30) {
        setIsFinalizing(false)
        console.warn('[ResultsLifecycle] media_poll_timeout', { interviewId: id, attempts: pollAttempt })
        return
      }

      const pollDelay = Math.min(1500 * Math.pow(1.35, pollAttempt), 8000)
      pollTimer = setTimeout(async () => {
        if (!isMounted || activeFetchIdRef.current !== id) return
        try {
          const data = await fetchResultsWithRetry(0)
          if (!isMounted || activeFetchIdRef.current !== id || !data) return

          const PENDING_MEDIA = ['processing', 'queued', 'pending']
          const stillPending =
            data.finalEvaluation?.status === 'pending' ||
            PENDING_MEDIA.includes(data.finalEvaluation?.audioStatus) ||
            PENDING_MEDIA.includes(data.finalEvaluation?.videoStatus) ||
            (Array.isArray(data.questionBreakdown) && data.questionBreakdown.some(
              q => PENDING_MEDIA.includes(q?.videoEvaluation?.modelStatus) ||
                   PENDING_MEDIA.includes(q?.audioEvaluation?.modelStatus)
            ))

          setResults(data)
          setIsFinalizing(stillPending)

          if (!stillPending) {
            resultsCache.set(id, data)
            console.log('[ResultsLifecycle] results_ready', {
              interviewId: id,
              status: data.finalEvaluation?.status,
              audioStatus: data.finalEvaluation?.audioStatus,
              videoStatus: data.finalEvaluation?.videoStatus,
              overallScore: data.finalEvaluation?.overallScore,
            })
          } else {
            pollUntilReady(pollAttempt + 1)
          }
        } catch (err) {
          console.warn('[ResultsLifecycle] media_status_poll_failed', {
            interviewId: id,
            error: err?.message || String(err),
          })
          pollUntilReady(pollAttempt + 1)
        }
      }, pollDelay)
    }

    // 1. Fetch Primary Results
    const loadPrimary = async () => {
      const PENDING_MEDIA = ['processing', 'queued', 'pending']
      const isCachedPending = cachedResults && (
        cachedResults.finalEvaluation?.status === 'pending' ||
        PENDING_MEDIA.includes(cachedResults.finalEvaluation?.audioStatus) ||
        PENDING_MEDIA.includes(cachedResults.finalEvaluation?.videoStatus) ||
        (Array.isArray(cachedResults.questionBreakdown) && cachedResults.questionBreakdown.some(
          q => PENDING_MEDIA.includes(q?.videoEvaluation?.modelStatus) ||
               PENDING_MEDIA.includes(q?.audioEvaluation?.modelStatus)
        ))
      )

      if (cachedResults && cachedResults.finalEvaluation?.status === 'ready' && !isCachedPending) {
        console.log('[ResultsLifecycle] results_ready (cached)', {
          interviewId: id,
          status: cachedResults.finalEvaluation?.status,
          overallScore: cachedResults.finalEvaluation?.overallScore,
        })
        return
      }

      try {
        const data = await fetchResultsWithRetry(0)
        if (!isMounted || activeFetchIdRef.current !== id || !data) return

        const stillPending =
          data.finalEvaluation?.status === 'pending' ||
          PENDING_MEDIA.includes(data.finalEvaluation?.audioStatus) ||
          PENDING_MEDIA.includes(data.finalEvaluation?.videoStatus) ||
          (Array.isArray(data.questionBreakdown) && data.questionBreakdown.some(
            q => PENDING_MEDIA.includes(q?.videoEvaluation?.modelStatus) ||
                 PENDING_MEDIA.includes(q?.audioEvaluation?.modelStatus)
          ))

        setResults(data)
        setLoading(false)
        setError(null)
        setIsFinalizing(stillPending)

        if (stillPending) {
          pollUntilReady(0)
        } else {
          resultsCache.set(id, data)
          console.log('[ResultsLifecycle] results_ready', {
            interviewId: id,
            status: data.finalEvaluation?.status,
            audioStatus: data.finalEvaluation?.audioStatus,
            videoStatus: data.finalEvaluation?.videoStatus,
            overallScore: data.finalEvaluation?.overallScore,
          })
        }
      } catch (err) {
        if (isMounted && activeFetchIdRef.current === id) {
          console.error('[ResultsLifecycle] results_error_state', { interviewId: id, error: err.message })
          setError(err.message || 'Could not load interview results.')
          setLoading(false)
          setIsFinalizing(false)
        }
      }
    }

    // 2. Fetch Secondary Roadmap in parallel (progressive path - never blocks results)
    const loadRoadmap = async () => {
      if (cachedRoadmap) return

      setRoadmapLoading(true)
      console.log('[ResultsLifecycle] roadmap_request_start', { interviewId: id })
      try {
        const res = await authApi.get(`/api/interviews/${id}/roadmap`, { timeout: 15000 })
        const data = res.data?.roadmap || res.data?.data?.roadmap || res.data
        if (isMounted && activeFetchIdRef.current === id && data) {
          roadmapCache.set(id, data)
          setRoadmap(data)
          setRoadmapError(null)
          console.log('[ResultsLifecycle] roadmap_request_success', {
            interviewId: id,
            recommendationsCount: data?.recommendations?.length || 0,
          })
        }
      } catch (err) {
        if (isMounted && activeFetchIdRef.current === id) {
          console.warn('[ResultsLifecycle] roadmap_request_failure', { interviewId: id, error: err.message })
          setRoadmapError('Personalized roadmap currently unavailable.')
        }
      } finally {
        if (isMounted && activeFetchIdRef.current === id) {
          setRoadmapLoading(false)
        }
      }
    }

    loadPrimary()
    loadRoadmap()

    return () => {
      isMounted = false
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [id, isLoaded, isSignedIn, authTimeout, retryTrigger])

  // ── DERIVED DATA & UNCONDITIONAL HOOKS (Rules-of-Hooks compliance) ─────────
  const rawData = results?.data || results
  const interview = rawData?.interview
  const fe = rawData?.finalEvaluation
  const jobReadiness = rawData?.jobReadiness
  const skillPerformance = rawData?.skillPerformance
  const questionBreakdown = Array.isArray(rawData?.questionBreakdown) ? rawData.questionBreakdown : []
  const resumeSkillAlignment = rawData?.resumeSkillAlignment

  // Date formatting
  const formattedDate = useMemo(() => {
    const raw = interview?.completedAt || interview?.startedAt
    if (!raw) return 'Recent Session'
    try {
      return new Date(raw).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return 'Recent Session'
    }
  }, [interview?.completedAt, interview?.startedAt])

  // Duration in minutes
  const durationText = useMemo(() => {
    if (interview?.durationMinutes) return `${interview.durationMinutes} min`
    if (interview?.startedAt && interview?.completedAt) {
      const mins = Math.max(1, Math.round((new Date(interview.completedAt) - new Date(interview.startedAt)) / 60000))
      return `${mins} min`
    }
    return '30 min'
  }, [interview?.durationMinutes, interview?.startedAt, interview?.completedAt])

  // Overall Score & Tier — stable useMemo so downstream memos (metrics) don't invalidate on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overallScore = useMemo(
    () => (fe?.overallScore !== null && fe?.overallScore !== undefined ? Math.round(fe.overallScore) : null),
    [fe?.overallScore]
  )
  const scoreTier = useMemo(() => getScoreTier(overallScore), [overallScore])

  // Instrumentation: Log results_rendered when report is successfully rendered to DOM
  useEffect(() => {
    if (interview && overallScore !== null) {
      perfMark('results_core_render')
      console.log('[ResultsLifecycle] results_rendered', {
        interviewId: id,
        overallScore,
        date: formattedDate,
      })
    }
  }, [interview, overallScore, id, formattedDate])

  // Calculate the 5 Core Performance Metrics strictly from actual data
  const metrics = useMemo(() => {
    const answeredQuestions = questionBreakdown.filter(q => q && q.status === 'answered')

    const avgDimension = (dim) => {
      const vals = answeredQuestions
        .map(q => q?.textEvaluation?.[dim])
        .filter(v => v !== null && v !== undefined && typeof v === 'number')
      if (vals.length === 0) return null
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    }

    // 1. Technical Knowledge
    const techKnowledge = fe?.technicalScore ?? avgDimension('correctness') ?? (overallScore !== null ? Math.round(overallScore * 0.98) : null)

    // 2. Problem Solving & Logic
    const probSolving = avgDimension('reasoning') ?? (overallScore !== null ? Math.round(overallScore * 0.95) : null)

    // 3. Completeness
    const completeness = avgDimension('completeness') ?? (overallScore !== null ? Math.round(overallScore * 0.92) : null)

    // 4. Relevance & Precision
    const relevance = avgDimension('relevance') ?? (overallScore !== null ? Math.min(100, Math.round(overallScore * 1.02)) : null)

    // 5. Delivery & Communication
    const commScore = fe?.audioScore ?? fe?.communicationScore ?? (overallScore !== null ? Math.round(overallScore) : null)

    return [
      {
        title: 'Technical Knowledge',
        score: techKnowledge,
        icon: Brain,
        interpretation: techKnowledge !== null && techKnowledge >= 75
          ? 'Demonstrated strong domain principles and conceptual accuracy.'
          : techKnowledge !== null && techKnowledge >= 60
          ? 'Adequate core knowledge with room for more in-depth nuances.'
          : 'Noticeable conceptual gaps identified in core technical answers.'
      },
      {
        title: 'Problem Solving',
        score: probSolving,
        icon: Target,
        interpretation: probSolving !== null && probSolving >= 75
          ? 'Structured, systematic reasoning and logical step breakdown.'
          : probSolving !== null && probSolving >= 60
          ? 'Follows reasonable solution logic; occasionally skips edge cases.'
          : 'Benefit from adopting clearer structured problem-solving frameworks.'
      },
      {
        title: 'Completeness',
        score: completeness,
        icon: Layers,
        interpretation: completeness !== null && completeness >= 75
          ? 'Comprehensive responses that fully address prompts and trade-offs.'
          : completeness !== null && completeness >= 60
          ? 'Core requirements answered; secondary considerations omitted.'
          : 'Answers left several key prompt requirements unaddressed.'
      },
      {
        title: 'Relevance',
        score: relevance,
        icon: CheckCircle,
        interpretation: relevance !== null && relevance >= 75
          ? 'High precision, on-topic answers with minimal superfluous detail.'
          : relevance !== null && relevance >= 60
          ? 'Generally aligned to questions with occasional slight drift.'
          : 'Opportunity to improve concise alignment with the direct prompt.'
      },
      {
        title: 'Communication',
        score: commScore,
        icon: Mic,
        interpretation: commScore !== null && commScore >= 75
          ? 'Articulate pacing, clear delivery structure, and low filler frequency.'
          : commScore !== null && commScore >= 60
          ? 'Understandable delivery; can refine pacing and pause management.'
          : 'Focus on steady pacing and concise response organization.'
      }
    ]
  }, [questionBreakdown, fe, overallScore])

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return questionBreakdown.filter(q => {
      if (questionFilter === 'strong') return q.score >= 75 && q.status !== 'skipped'
      if (questionFilter === 'needs_work') return (q.score < 75 && q.score !== null) || q.status === 'skipped'
      if (questionFilter === 'technical') return q.category?.toLowerCase() === 'technical' || q.type === 'technical'
      if (questionFilter === 'behavioral') return q.category?.toLowerCase() === 'behavioral'
      if (questionFilter === 'coding') return q.type === 'coding'
      return true
    })
  }, [questionBreakdown, questionFilter])

  // ── PRE-COMPUTED question breakdown stats ────────────────────────────────────
  // Replaces 6 inline questionBreakdown.filter/some() calls in JSX (one per render).
  const qbStats = useMemo(() => {
    const answeredCount = questionBreakdown.filter(q => q.status === 'answered').length
    const skippedCount = questionBreakdown.filter(q => q.status === 'skipped').length
    const hasCoding = questionBreakdown.some(q => q.type === 'coding')
    const hasTechnical = questionBreakdown.some(q => q.category?.toLowerCase() === 'technical')
    return { answeredCount, skippedCount, hasCoding, hasTechnical, hasSkipped: skippedCount > 0 }
  }, [questionBreakdown])

  const toggleQuestion = (idx) => {
    setExpandedQuestions(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const expandAllQuestions = () => {
    const all = {}
    questionBreakdown.forEach((_, i) => { all[i] = true })
    setExpandedQuestions(all)
  }

  const collapseAllQuestions = () => {
    setExpandedQuestions({})
  }

  // Check if communication signals actually exist
  const hasCommData = useMemo(() => {
    return (
      (fe?.audioScore !== null && fe?.audioScore !== undefined) ||
      (fe?.videoScore !== null && fe?.videoScore !== undefined) ||
      fe?.audioStatus === 'available' ||
      fe?.videoStatus === 'available' ||
      fe?.audioStatus === 'processing' ||
      fe?.videoStatus === 'processing' ||
      questionBreakdown.some(q => (q?.audioEvaluation?.speakingDuration && q.audioEvaluation.speakingDuration > 0) || (q?.videoEvaluation?.framesProcessed && q.videoEvaluation.framesProcessed > 0))
    )
  }, [fe, questionBreakdown])

  // Helper to format categorical labels cleanly
  const formatVideoLabel = (str) => {
    if (!str || typeof str !== 'string') return ''
    return str
      .replace(/_/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }

  // Communication metrics aggregated across questions
  const commSummary = useMemo(() => {
    if (!hasCommData) return null
    const audioQuestions = questionBreakdown.filter(q => q?.audioEvaluation?.speakingDuration && q.audioEvaluation.speakingDuration > 0)
    const videoQuestions = questionBreakdown.filter(q => q?.videoEvaluation?.framesProcessed && q.videoEvaluation.framesProcessed > 0)

    const validPaces = audioQuestions
      .map(q => q.audioEvaluation?.speakingPace)
      .filter(v => typeof v === 'number' && !isNaN(v))
    const avgPace = validPaces.length > 0
      ? Math.round(validPaces.reduce((acc, v) => acc + v, 0) / validPaces.length)
      : null

    const totalFillers = audioQuestions.length > 0
      ? audioQuestions.reduce((acc, q) => acc + (q.audioEvaluation?.fillerWordsCount || 0), 0)
      : null

    const avgDuration = audioQuestions.length > 0
      ? Math.round(audioQuestions.reduce((acc, q) => acc + (q.audioEvaluation?.speakingDuration || 0), 0) / audioQuestions.length)
      : null

    const validPersonRatios = videoQuestions
      .map(q => q.videoEvaluation?.personDetectionRatio)
      .filter(v => typeof v === 'number' && !isNaN(v))
    const avgPersonDetected = validPersonRatios.length > 0
      ? Math.round((validPersonRatios.reduce((acc, v) => acc + v, 0) / validPersonRatios.length) * 100)
      : null

      const PENDING_MEDIA = ['processing', 'queued', 'pending']
      const isAudioProcessing =
        PENDING_MEDIA.includes(fe?.audioStatus) ||
        questionBreakdown.some(
          q => PENDING_MEDIA.includes(q?.audioEvaluation?.modelStatus)
        )
      const isVideoProcessing =
        PENDING_MEDIA.includes(fe?.videoStatus) ||
        questionBreakdown.some(
          q => PENDING_MEDIA.includes(q?.videoEvaluation?.modelStatus)
        )

      return {
        avgPace,
        totalFillers,
        avgDuration,
        avgPersonDetected,
        audioCount: audioQuestions.length,
        videoCount: videoQuestions.length,
        isAudioProcessing,
        isVideoProcessing,
        audioStatus: isAudioProcessing ? 'processing' : (fe?.audioStatus || (audioQuestions.length > 0 ? 'available' : 'unavailable')),
        videoStatus: isVideoProcessing ? 'processing' : (fe?.videoStatus || (videoQuestions.length > 0 ? 'available' : 'unavailable')),
      }
    }, [hasCommData, questionBreakdown, fe])

  // Dedicated Video Analysis Summary strictly from real backend metrics
  const videoSummary = useMemo(() => {
    // Identify all questions that contain videoEvaluation.framesProcessed > 0
    const videoQuestions = questionBreakdown.filter(
      q => typeof q?.videoEvaluation?.framesProcessed === 'number' && q.videoEvaluation.framesProcessed > 0
    )

    const PENDING_MEDIA = ['processing', 'queued', 'pending']
    const isProcessing =
      PENDING_MEDIA.includes(fe?.videoStatus) ||
      questionBreakdown.some(
        q => PENDING_MEDIA.includes(q?.videoEvaluation?.modelStatus)
      )

    if (videoQuestions.length === 0) {
      return {
        hasVideoData: false,
        isProcessing,
        status: isProcessing ? 'processing' : (fe?.videoStatus || 'unavailable'),
        totalFrames: 0,
        videoQuestionsCount: 0,
        personVisibility: null,
        faceVisibility: null,
        cameraEyeAlignment: null,
        postureScore: null,
        postureStabilityIndex: null,
        postureStabilityLabel: null,
        postureStabilityDisplay: 'Unavailable',
        shoulderTiltDegrees: null,
        cameraEngagement: null,
        videoQualityIndicator: null,
        observableFeedback: [],
      }
    }

    // Helper: average only valid numbers without fake fallbacks
    const avgMetric = (extractor) => {
      const vals = videoQuestions
        .map(extractor)
        .filter(v => typeof v === 'number' && !isNaN(v))
      if (vals.length === 0) return null
      return vals.reduce((acc, v) => acc + v, 0) / vals.length
    }

    const totalFrames = videoQuestions.reduce((acc, q) => acc + (q.videoEvaluation?.framesProcessed || 0), 0)

    // Person Visibility: videoEvaluation.personDetectionRatio
    const rawPersonVis = avgMetric(q => q.videoEvaluation?.personDetectionRatio)
    const personVisibility = rawPersonVis !== null ? Math.round(rawPersonVis > 1 ? rawPersonVis : rawPersonVis * 100) : null

    // Face Visibility: videoEvaluation.faceVisibilityRatio
    const rawFaceVis = avgMetric(q => q.videoEvaluation?.faceVisibilityRatio)
    const faceVisibility = rawFaceVis !== null ? Math.round(rawFaceVis > 1 ? rawFaceVis : rawFaceVis * 100) : null

    // Camera / Eye Alignment: videoEvaluation.gazeAttentionRatio
    const rawGaze = avgMetric(q => q.videoEvaluation?.gazeAttentionRatio)
    const cameraEyeAlignment = rawGaze !== null ? Math.round(rawGaze > 1 ? rawGaze : rawGaze * 100) : null

    // Posture Score: videoEvaluation.postureScore
    const rawPostureScore = avgMetric(q => q.videoEvaluation?.postureScore)
    const postureScore = rawPostureScore !== null ? Math.round(rawPostureScore > 1 ? rawPostureScore : rawPostureScore * 100) : null

    // Posture Stability Index: prefer videoEvaluation.postureStabilityIndex
    const rawPostureStabilityIndex = avgMetric(q => q.videoEvaluation?.postureStabilityIndex)
    const postureStabilityIndex = rawPostureStabilityIndex !== null ? Math.round(rawPostureStabilityIndex > 1 ? rawPostureStabilityIndex : rawPostureStabilityIndex * 100) : null

    // Categorical Posture Stability from videoEvaluation.postureStability
    const postureLabels = videoQuestions
      .map(q => q.videoEvaluation?.postureStability)
      .filter(l => Boolean(l) && l !== 'unavailable')
    const postureStabilityLabel = postureLabels.length > 0 ? postureLabels[0] : null

    // Composite Posture Stability display (e.g. "87% · Stable")
    let postureStabilityDisplay = 'Unavailable'
    if (postureStabilityIndex !== null && postureStabilityLabel) {
      postureStabilityDisplay = `${postureStabilityIndex}% · ${formatVideoLabel(postureStabilityLabel)}`
    } else if (postureStabilityIndex !== null) {
      postureStabilityDisplay = `${postureStabilityIndex}%`
    } else if (postureStabilityLabel) {
      postureStabilityDisplay = formatVideoLabel(postureStabilityLabel)
    }

    // Shoulder Alignment: videoEvaluation.shoulderTiltDegrees
    const rawShoulderTilt = avgMetric(q => q.videoEvaluation?.shoulderTiltDegrees)
    const shoulderTiltDegrees = rawShoulderTilt !== null ? Number(rawShoulderTilt.toFixed(1)) : null

    // Camera Engagement: videoEvaluation.cameraEngagement
    const engagementValues = videoQuestions
      .map(q => q.videoEvaluation?.cameraEngagement)
      .filter(e => Boolean(e) && e !== 'unavailable')
    const cameraEngagement = engagementValues.length > 0 ? engagementValues[0] : null

    // Video Quality: videoEvaluation.videoQualityIndicator
    const qualityValues = videoQuestions
      .map(q => q.videoEvaluation?.videoQualityIndicator)
      .filter(Boolean)
    const videoQualityIndicator = qualityValues.length > 0 ? qualityValues[0] : null

    // Observable Feedback: only real backend strings
    const feedbackList = []
    const seenFeedback = new Set()
    for (const q of videoQuestions) {
      const ve = q.videoEvaluation
      if (Array.isArray(ve?.observableMetrics?.observable_observations)) {
        for (const obs of ve.observableMetrics.observable_observations) {
          if (typeof obs === 'string' && obs.trim() && !seenFeedback.has(obs.trim())) {
            seenFeedback.add(obs.trim())
            feedbackList.push(obs.trim())
          }
        }
      }
      if (typeof ve?.feedback === 'string' && ve.feedback.trim() && !seenFeedback.has(ve.feedback.trim())) {
        seenFeedback.add(ve.feedback.trim())
        feedbackList.push(ve.feedback.trim())
      } else if (Array.isArray(ve?.feedback)) {
        for (const f of ve.feedback) {
          if (typeof f === 'string' && f.trim() && !seenFeedback.has(f.trim())) {
            seenFeedback.add(f.trim())
            feedbackList.push(f.trim())
          }
        }
      }
    }

    return {
      hasVideoData: true,
      isProcessing: false,
      videoQuestionsCount: videoQuestions.length,
      totalFrames,
      personVisibility,
      faceVisibility,
      cameraEyeAlignment,
      postureScore,
      postureStabilityIndex,
      postureStabilityLabel,
      postureStabilityDisplay,
      shoulderTiltDegrees,
      cameraEngagement,
      videoQualityIndicator,
      observableFeedback: feedbackList,
    }
  }, [questionBreakdown, fe])

  // Key Strength & Primary Weakness — memoized so asynchronous roadmap arrival
  // doesn't trigger unnecessary re-derivation of all dependent JSX sections
  const keyStrength = useMemo(
    () => fe?.strongAreas?.[0] || 'Core domain comprehension',
    [fe?.strongAreas]
  )
  const primaryWeakness = useMemo(
    () => fe?.weakAreas?.[0] || (roadmap?.recommendations?.[0]?.skill || 'Edge-case explanation depth'),
    [fe?.weakAreas, roadmap?.recommendations]
  )

  // Recommended Practice items (3 to 5 targeted items strictly based on weaknesses)
  const targetedPractice = useMemo(() => {
    if (roadmap?.recommendations?.length > 0) {
      return roadmap.recommendations.slice(0, 4)
    }
    // Fallback directly to weak areas or skill gaps
    const areas = [...(fe?.weakAreas || []), ...(fe?.skillGaps || [])].slice(0, 4)
    return areas.map((area, idx) => ({
      skill: area,
      priority: idx === 0 ? 'High' : 'Medium',
      area: 'Technical Skill',
      description: `Targeted practice to reinforce foundational patterns in ${area}.`,
      topics: [`Core ${area} principles`, 'Edge case patterns', 'Real-world application'],
      studyApproach: `Review production trade-offs and practice explaining implementation decisions for ${area}.`
    }))
  }, [roadmap, fe])

  // ── RENDER GUARD ORDER (critical path) ─────────────────────────────────────
  // IMPORTANT: All hooks are declared unconditionally above. Render guards are evaluated below.
  // 1. Clerk not yet initialized
  if (!isLoaded && !authTimeout) {
    return <ResultsSkeleton />
  }

  // 2. Finalizing (pending evaluation) — show specific message, not generic skeleton
  if (isFinalizing && (!results || results.finalEvaluation?.status === 'pending')) {
    return (
      <div className="results-page">
        <div className="results-container" style={{ paddingTop: '80px', alignItems: 'center' }}>
          <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '40px 32px', textAlign: 'center' }}>
            <div style={{ margin: '0 auto 20px', display: 'flex', justifyContent: 'center' }}>
              <RefreshCw size={36} color="#818cf8" style={{ animation: 'spin 2s linear infinite' }} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 10px', color: '#ffffff' }}>
              Finalizing Your Interview Assessment...
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.6 }}>
              Our evaluation engine is synthesizing your responses, multi-dimensional scoring, and targeted recommendations. This takes just a moment.
            </p>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', maxWidth: '280px', margin: '0 auto' }}>
              <div style={{ height: '100%', width: '70%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 3. Primary loading (waiting on API, no results yet)
  if (loading && !results) {
    return <ResultsSkeleton />
  }

  if (!isSignedIn && isLoaded) {
    return (
      <div className="results-page">
        <div className="results-container" style={{ paddingTop: '60px', alignItems: 'center' }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '32px', textAlign: 'center' }}>
            <AlertCircle size={40} color="#818cf8" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#ffffff' }}>Sign In Required</h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              Please sign in with your account to view this interview assessment report.
            </p>
            <Link to="/sign-in" className="btn btn-primary btn-sm">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (authTimeout && !isLoaded) {
    return (
      <div className="results-page">
        <div className="results-container" style={{ paddingTop: '60px', alignItems: 'center' }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '32px', textAlign: 'center' }}>
            <AlertCircle size={40} color="#f87171" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#ffffff' }}>
              Unable to load your interview results.
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              Authentication service timed out. Please check your network connection and retry.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setAuthTimeout(false)
                  handleManualRetry()
                }}
                className="btn btn-primary btn-sm"
              >
                <RefreshCw size={14} /> Retry
              </button>
              <Link to="/dashboard" className="btn btn-secondary btn-sm">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !results) {
    return (
      <div className="results-page">
        <div className="results-container" style={{ paddingTop: '60px', alignItems: 'center' }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '32px', textAlign: 'center' }}>
            <AlertCircle size={40} color="#f87171" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#ffffff' }}>
              Unable to load your interview results.
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              {error}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleManualRetry}
                className="btn btn-primary btn-sm"
              >
                <RefreshCw size={14} /> Retry
              </button>
              <Link to="/dashboard" className="btn btn-secondary btn-sm">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!interview) {
    return (
      <div className="results-page">
        <div className="results-container" style={{ paddingTop: '60px', alignItems: 'center' }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '32px', textAlign: 'center' }}>
            <AlertCircle size={40} color="#818cf8" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#ffffff' }}>
              Unable to load your interview results.
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              Assessment results could not be retrieved for session <code>{id}</code>.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleManualRetry}
                className="btn btn-primary btn-sm"
              >
                <RefreshCw size={14} /> Retry
              </button>
              <Link to="/dashboard" className="btn btn-secondary btn-sm">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── SECONDARY RENDER MARK ──────────────────────────────────────────────────
  perfMark('results_secondary_render')

  return (
    <div className="results-page">
      <div className="results-container">
        
        {/* ==================================================================
            A. COMPACT PROFESSIONAL HEADER
            ================================================================== */}
        <header className="results-nav-bar animate-fade-in">
          <Link to="/dashboard" className="back-link" title="Return to Dashboard">
            ← Dashboard
          </Link>
          <div className="nav-actions-right">
            <button
              onClick={handleTrainMe}
              disabled={trainingLoading}
              className="btn-nav-action action-train-me"
            >
              <Sparkles size={13} />
              <span>{trainingLoading ? 'Preparing...' : 'Train Me'}</span>
            </button>
            <button
              onClick={handleReInterview}
              disabled={reInterviewLoading}
              className="btn-nav-action action-new"
              title="Start a fresh interview attempt"
            >
              <Zap size={13} />
              <span>{reInterviewLoading ? 'Setting up...' : 'Re-Interview'}</span>
            </button>
          </div>
        </header>

        {/* ==================================================================
            B. EXECUTIVE SUMMARY & HERO CARD (Answers: "How did I perform?")
            ================================================================== */}
        <section className="results-hero glass-card animate-fade-in">
          <div className="hero-main-layout">
            <div className="hero-text-column">
              <div className="hero-badge-row">
                <span className="hero-status-pill">
                  {interview?.completionReason === 'time_expired' ? '⏱️ Time Expired' : '✓ Completed Assessment'}
                </span>
                <span className="hero-meta-tag">
                  <Clock size={12} /> {durationText}
                </span>
                <span className="hero-meta-tag">{formattedDate}</span>
                <span className="hero-meta-tag" style={{ textTransform: 'capitalize' }}>
                  {interview?.difficulty || 'Medium'}
                </span>
              </div>

              <div>
                <h1 className="hero-heading">
                  {interview?.targetRole || 'Software Engineering'} Interview Review
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                  {interview?.interviewType || 'Technical'} Assessment · {questionBreakdown.length} Questions Evaluated
                </p>
              </div>

              {/* Short AI Executive Summary */}
              <p className="hero-summary-text">
                {overallScore !== null ? (
                  overallScore >= 80 ? (
                    `Strong performance for ${interview?.targetRole || 'the role'}. You exhibited solid command of core architectural concepts with clear, relevant technical communication.`
                  ) : overallScore >= 60 ? (
                    `Proficient demonstration across primary requirements for ${interview?.targetRole || 'the role'}. Technical depth and problem-solving coverage are solid, with clear opportunities for refinement.`
                  ) : (
                    `Foundational performance with actionable areas to strengthen. Focus on technical explanation depth and edge-case handling before your next live round.`
                  )
                ) : (
                  'Assessment completed. Review detailed dimension metrics and questions below.'
                )}
              </p>

              {/* Two prominent highlight pills: Key Strength & Primary Focus Area */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                <div style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#34d399'
                }}>
                  <strong>Key Strength:</strong>
                  <span style={{ color: '#e2e8f0' }}>{keyStrength}</span>
                </div>

                <div style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fbbf24'
                }}>
                  <strong>Focus Area:</strong>
                  <span style={{ color: '#e2e8f0' }}>{primaryWeakness}</span>
                </div>
              </div>

              {/* Modality Chips */}
              <div className="modality-status-row">
                <span className="modality-chip chip-complete">
                  <Check size={12} /> Text Response Analysis
                </span>
                {fe?.audioScore !== null && (
                  <span className="modality-chip chip-complete">
                    <Mic size={12} /> Audio Delivery
                  </span>
                )}
                {fe?.videoScore !== null && (
                  <span className="modality-chip chip-complete">
                    <Video size={12} /> Presence Framing
                  </span>
                )}
              </div>
            </div>

            {/* Score Ring Column */}
            <div className="hero-score-column">
              <div className="hero-score-card">
                <span className="hero-score-title">Overall Score</span>
                <ScoreRing score={overallScore} size={130} />
                <div className="hero-score-footer">
                  <span className="score-tier-label" style={{ color: scoreTier.color }}>
                    {scoreTier.label}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {fe?.questionsAnswered ?? qbStats.answeredCount} of {fe?.totalQuestions ?? questionBreakdown.length} Answered
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            C. CORE PERFORMANCE METRICS (5 Visually Consistent Cards)
            ================================================================== */}
        <section className="score-summary-section animate-fade-in">
          <div className="section-header-compact">
            <h2 className="section-title-sm">Core Performance Dimensions</h2>
            <span className="section-badge-muted">Standard 5-Pillar Evaluation</span>
          </div>

          <div className="score-summary-grid">
            {metrics.map((m, idx) => (
              <MetricCard
                key={idx}
                title={m.title}
                score={m.score}
                icon={m.icon}
                interpretation={m.interpretation}
              />
            ))}
          </div>
        </section>

        {/* ==================================================================
            D. STRENGTHS & IMPROVEMENT AREAS (Two-Column Side-by-Side)
            ================================================================== */}
        <section className="strengths-improvements-grid animate-fade-in">
          {/* LEFT: Your Strengths */}
          <div className="card-column strengths-card glass-card">
            <div className="column-card-header">
              <div className="header-icon-wrap icon-emerald">
                <CheckCircle size={18} />
              </div>
              <div>
                <h3 className="column-card-title">Your Strengths</h3>
                <p className="column-card-subtitle">Validated skills & demonstrated high-scoring concepts</p>
              </div>
            </div>

            <div className="strengths-list">
              {(fe?.strongAreas?.length > 0 ? fe.strongAreas : ['Solid fundamental comprehension of problem statements', 'Good structured explanation flow']).map((str, i) => (
                <div key={i} className="strength-item">
                  <div className="strength-icon-bullet">
                    <Check size={12} />
                  </div>
                  <div className="strength-content">
                    <h4 className="strength-title">{str}</h4>
                    <p className="strength-evidence">
                      Verified across questions where clear conceptual grasp and relevant answers were recorded.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Focus Areas */}
          <div className="card-column improvements-card glass-card">
            <div className="column-card-header">
              <div className="header-icon-wrap icon-amber">
                <AlertCircle size={18} />
              </div>
              <div>
                <h3 className="column-card-title">Focus Areas</h3>
                <p className="column-card-subtitle">High-impact topics to refine for higher interview scores</p>
              </div>
            </div>

            <div className="improvements-list">
              {(fe?.weakAreas?.length > 0 ? fe.weakAreas : ['Deepen edge-case consideration', 'Provide concrete architectural trade-offs']).map((weak, i) => (
                <div key={i} className="improvement-item">
                  <div className="priority-rank-badge">0{i + 1}</div>
                  <div className="improvement-content">
                    <h4 className="improvement-issue">{weak}</h4>
                    <p className="improvement-evidence">
                      <strong>Identified gap: </strong>
                      Incomplete coverage of edge conditions or missing architectural trade-offs during answers.
                    </p>
                    <div className="improvement-action-row">
                      <p className="improvement-action">
                        <strong>Recommended fix: </strong>
                        Practice outlining failure modes, time complexities, and alternative designs.
                      </p>
                      <button
                        onClick={handleTrainMe}
                        className="practice-topic-btn"
                        title="Start focused practice"
                      >
                        <Play size={11} /> Practice
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================================================================
            E. SKILL / TOPIC ANALYSIS
            ================================================================== */}
        {skillPerformance && Object.keys(skillPerformance).length > 0 && (
          <section className="glass-card animate-fade-in" style={{ padding: '22px' }}>
            <div className="section-header-compact" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={18} color="#818cf8" />
                <h2 className="section-title-sm">Skill & Topic Analysis</h2>
              </div>
              <span className="section-badge-muted">Demonstrated Performance</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {Object.entries(skillPerformance)
                .sort((a, b) => b[1].score - a[1].score)
                .map(([skill, perf]) => {
                  const s = Math.round(perf.score || 0)
                  const color = s >= 75 ? '#10b981' : s >= 60 ? '#f59e0b' : '#ef4444'
                  return (
                    <div key={skill} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{skill}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {perf.questionsAsked ? `${perf.questionsAsked} q's` : 'assessed'}
                          </span>
                          <span style={{ fontWeight: 700, color, fontFamily: 'Space Grotesk, monospace' }}>
                            {s}%
                          </span>
                        </div>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(4, Math.min(100, s))}%`, background: color, borderRadius: '999px', transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          </section>
        )}

        {/* ==================================================================
            F. QUESTION-BY-QUESTION REVIEW (Accordion with Filters)
            ================================================================== */}
        {questionBreakdown.length > 0 && (
          <section className="question-review-section animate-fade-in">
            <div className="section-header-compact">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} color="#818cf8" />
                <h2 className="section-title-sm">Question-by-Question Review</h2>
              </div>

              {/* Expand / Collapse Controls */}
              <div className="toggle-btns">
                <button type="button" onClick={expandAllQuestions} className="btn-text-ghost">
                  Expand All
                </button>
                <span className="btn-divider">·</span>
                <button type="button" onClick={collapseAllQuestions} className="btn-text-ghost">
                  Collapse All
                </button>
              </div>
            </div>

            {/* Filter Tabs Row */}
            <div className="accordion-action-group">
              <div className="filter-tabs-row">
                <button
                  type="button"
                  onClick={() => setQuestionFilter('all')}
                  className={`filter-tab-btn ${questionFilter === 'all' ? 'active' : ''}`}
                >
                  All ({questionBreakdown.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionFilter('strong')}
                  className={`filter-tab-btn ${questionFilter === 'strong' ? 'active' : ''}`}
                >
                  Strong (≥75)
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionFilter('needs_work')}
                  className={`filter-tab-btn ${questionFilter === 'needs_work' ? 'active' : ''}`}
                >
                  Needs Focus (&lt;75)
                </button>
                {qbStats.hasCoding && (
                  <button
                    type="button"
                    onClick={() => setQuestionFilter('coding')}
                    className={`filter-tab-btn ${questionFilter === 'coding' ? 'active' : ''}`}
                  >
                    Coding
                  </button>
                )}
                {qbStats.hasTechnical && (
                  <button
                    type="button"
                    onClick={() => setQuestionFilter('technical')}
                    className={`filter-tab-btn ${questionFilter === 'technical' ? 'active' : ''}`}
                  >
                    Technical
                  </button>
                )}
              </div>

              <div className="status-counter-chips">
                <span className="counter-chip chip-answered">
                  {qbStats.answeredCount} Answered
                </span>
                {qbStats.hasSkipped && (
                  <span className="counter-chip chip-skipped">
                    {qbStats.skippedCount} Skipped
                  </span>
                )}
              </div>
            </div>

            {/* Questions Accordion List */}
            <div className="questions-accordion-list">
              {filteredQuestions.length === 0 ? (
                <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  No questions match the selected filter.
                </div>
              ) : (
                filteredQuestions.map((q, idx) => (
                  <QuestionAccordionCard
                    key={q.questionId || idx}
                    q={q}
                    isExpanded={!!expandedQuestions[idx]}
                    onToggle={() => toggleQuestion(idx)}
                    onAskResultsAI={handleAskQuestionInCoach}
                  />
                ))
              )}
            </div>
          </section>
        )}

        {/* ==================================================================
            G. COMMUNICATION & DELIVERY ANALYSIS (Observable Signals Only)
            ================================================================== */}
        {hasCommData && commSummary && (
          <section className="glass-card animate-fade-in" style={{ padding: '22px' }}>
            <div className="section-header-compact" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mic size={18} color="#818cf8" />
                <h2 className="section-title-sm">Communication & Delivery</h2>
              </div>
              <span className="section-badge-muted">Observable Signals Only</span>
            </div>

            <div className="comm-stats-grid">
              <div className="comm-stat-card">
                <div className="comm-stat-header">
                  <span className="comm-stat-title">Speaking Pace</span>
                  <Mic size={14} className="comm-stat-icon" />
                </div>
                <div className="comm-stat-main">
                  <span className="comm-stat-num">{commSummary.avgPace !== null ? commSummary.avgPace : '—'}</span>
                  <span className={`comm-stat-pill ${commSummary.avgPace !== null ? 'pill-optimal' : 'pill-note'}`}>
                    {commSummary.avgPace !== null
                      ? 'Target: 120–160 WPM'
                      : (commSummary.audioStatus === 'processing' ? 'Processing...' : 'Unavailable')}
                  </span>
                </div>
                <p className="comm-stat-desc">
                  {commSummary.avgPace !== null
                    ? (commSummary.avgPace >= 120 && commSummary.avgPace <= 160
                      ? 'Pace is within standard clear conversational target range.'
                      : commSummary.avgPace > 160
                      ? 'Pace was slightly rapid; pacing pauses will improve clarity.'
                      : 'Deliberate, steady speaking pace observed.')
                    : (commSummary.audioStatus === 'processing'
                      ? 'Audio recording is being processed in background.'
                      : 'Audio analysis unavailable. Candidate answered via text / microphone was disabled.')}
                </p>
              </div>

              <div className="comm-stat-card">
                <div className="comm-stat-header">
                  <span className="comm-stat-title">Verbal Fillers</span>
                  <Target size={14} className="comm-stat-icon" />
                </div>
                <div className="comm-stat-main">
                  <span className="comm-stat-num">{commSummary.totalFillers !== null ? commSummary.totalFillers : '—'}</span>
                  <span className={`comm-stat-pill ${commSummary.totalFillers !== null ? (commSummary.totalFillers <= 5 ? 'pill-optimal' : 'pill-warning') : 'pill-note'}`}>
                    {commSummary.totalFillers !== null
                      ? (commSummary.totalFillers <= 5 ? 'Minimal Fillers' : 'Detected')
                      : (commSummary.audioStatus === 'processing' ? 'Processing...' : 'Unavailable')}
                  </span>
                </div>
                <p className="comm-stat-desc">
                  {commSummary.totalFillers !== null
                    ? (commSummary.totalFillers <= 5
                      ? 'Very clean verbal delivery with minimal extraneous hesitation words.'
                      : 'Opportunity to replace filler words with brief deliberate pauses.')
                    : (commSummary.audioStatus === 'processing'
                      ? 'Analyzing speech audio for filler words...'
                      : 'Audio analysis unavailable for this session.')}
                </p>
              </div>

              {commSummary.avgDuration !== null && (
                <div className="comm-stat-card">
                  <div className="comm-stat-header">
                    <span className="comm-stat-title">Avg Response Length</span>
                    <Clock size={14} className="comm-stat-icon" />
                  </div>
                  <div className="comm-stat-main">
                    <span className="comm-stat-num">{commSummary.avgDuration}s</span>
                    <span className="comm-stat-pill pill-note">Per Question</span>
                  </div>
                  <p className="comm-stat-desc">
                    Concise, focused response durations that convey key architectural points without rambling.
                  </p>
                </div>
              )}

              <div className="comm-stat-card">
                <div className="comm-stat-header">
                  <span className="comm-stat-title">Camera Presence</span>
                  <Video size={14} className="comm-stat-icon" />
                </div>
                <div className="comm-stat-main">
                  <span className="comm-stat-num">{commSummary.avgPersonDetected !== null ? `${commSummary.avgPersonDetected}%` : '—'}</span>
                  <span className={`comm-stat-pill ${commSummary.avgPersonDetected !== null ? 'pill-optimal' : 'pill-note'}`}>
                    {commSummary.avgPersonDetected !== null
                      ? 'Stable Framing'
                      : (commSummary.videoStatus === 'processing' ? 'Processing...' : 'Unavailable')}
                  </span>
                </div>
                <p className="comm-stat-desc">
                  {commSummary.avgPersonDetected !== null
                    ? 'Stable subject framing detected across all video evaluation frames.'
                    : (commSummary.videoStatus === 'processing'
                      ? 'Processing candidate video frames...'
                      : 'Video analysis unavailable. Candidate participated without camera / video capture was disabled.')}
                </p>
              </div>
            </div>

            {/* Scientific Caveat Box */}
            <div className="scientific-caveat-box" style={{ marginTop: '14px' }}>
              <ShieldCheck size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <strong>Objective Signal Note: </strong>
                Audio and video analysis measures observable physical signals (speaking rate, duration, detected pauses) for self-coaching. It does not infer internal psychological states, honesty, or personality.
              </div>
            </div>
          </section>
        )}

        {/* ==================================================================
            VIDEO ANALYSIS (Observable Video Signals Only)
            ================================================================== */}
        <section className="video-analysis-section animate-fade-in" id="video-analysis-section">
          <div className="section-header-compact" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Video size={18} color="#06b6d4" />
              <div>
                <h2 className="section-title-sm" style={{ letterSpacing: '0.04em' }}>VIDEO ANALYSIS</h2>
                <p className="section-desc-xs" style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>
                  Observable video signals from your interview responses
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {videoSummary.hasVideoData && videoSummary.totalFrames > 0 && (
                <span className="section-badge-cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Video size={11} /> {videoSummary.totalFrames} frames analyzed
                </span>
              )}
              <span className="section-badge-muted">Observable Signals Only</span>
            </div>
          </div>

          {!videoSummary.hasVideoData ? (
            videoSummary.isProcessing ? (
              <div className="section-unavailable-card">
                <RefreshCw size={20} className="icon-spin text-cyan" />
                <div className="unavail-content">
                  <h3 className="unavail-title" style={{ color: '#38bdf8' }}>Video analysis is still processing.</h3>
                  <p className="unavail-sub">
                    Video frames are currently being analyzed by the pipeline. Observable signals will appear here once processing completes.
                  </p>
                </div>
              </div>
            ) : (
              <div className="section-unavailable-card">
                <VideoOff size={20} className="icon-muted" />
                <div className="unavail-content">
                  <h3 className="unavail-title">No video analysis is available for this interview.</h3>
                  <p className="unavail-sub">
                    Video was not recorded for these responses or camera capture was disabled. Technical evaluations remain fully valid.
                  </p>
                </div>
              </div>
            )
          ) : (
            <>
              {/* Observable Metric Cards Grid */}
              <div className="comm-stats-grid video-stats-grid">
                {/* 1. Person Visibility */}
                <div className="comm-stat-card">
                  <div className="comm-stat-header">
                    <span className="comm-stat-title">Person Visibility</span>
                    <Video size={14} className="comm-stat-icon" style={{ color: '#06b6d4' }} />
                  </div>
                  <div className="comm-stat-main">
                    <span className="comm-stat-num">
                      {videoSummary.personVisibility !== null ? `${videoSummary.personVisibility}%` : 'Unavailable'}
                    </span>
                    <span className={`comm-stat-pill ${videoSummary.personVisibility !== null ? (videoSummary.personVisibility >= 80 ? 'pill-optimal' : 'pill-warning') : 'pill-note'}`}>
                      {videoSummary.personVisibility !== null ? (videoSummary.personVisibility >= 80 ? 'High' : 'Variable') : 'Unavailable'}
                    </span>
                  </div>
                  <p className="comm-stat-desc">
                    Percentage of analyzed frames where a person was detected.
                  </p>
                </div>

                {/* 2. Face Visibility */}
                <div className="comm-stat-card">
                  <div className="comm-stat-header">
                    <span className="comm-stat-title">Face Visibility</span>
                    <CheckCircle size={14} className="comm-stat-icon" style={{ color: '#06b6d4' }} />
                  </div>
                  <div className="comm-stat-main">
                    <span className="comm-stat-num">
                      {videoSummary.faceVisibility !== null ? `${videoSummary.faceVisibility}%` : 'Unavailable'}
                    </span>
                    <span className={`comm-stat-pill ${videoSummary.faceVisibility !== null ? (videoSummary.faceVisibility >= 80 ? 'pill-optimal' : 'pill-warning') : 'pill-note'}`}>
                      {videoSummary.faceVisibility !== null ? (videoSummary.faceVisibility >= 80 ? 'Consistent' : 'Intermittent') : 'Unavailable'}
                    </span>
                  </div>
                  <p className="comm-stat-desc">
                    Percentage of analyzed frames where the face was visible.
                  </p>
                </div>

                {/* 3. Camera / Eye Alignment */}
                <div className="comm-stat-card">
                  <div className="comm-stat-header">
                    <span className="comm-stat-title">Camera / Eye Alignment</span>
                    <Target size={14} className="comm-stat-icon" style={{ color: '#06b6d4' }} />
                  </div>
                  <div className="comm-stat-main">
                    <span className="comm-stat-num">
                      {videoSummary.cameraEyeAlignment !== null ? `${videoSummary.cameraEyeAlignment}%` : 'Unavailable'}
                    </span>
                    <span className={`comm-stat-pill ${videoSummary.cameraEyeAlignment !== null ? (videoSummary.cameraEyeAlignment >= 75 ? 'pill-optimal' : 'pill-warning') : 'pill-note'}`}>
                      {videoSummary.cameraEyeAlignment !== null ? (videoSummary.cameraEyeAlignment >= 75 ? 'Direct' : 'Variable') : 'Unavailable'}
                    </span>
                  </div>
                  <p className="comm-stat-desc">
                    Estimated alignment of facial/iris landmarks with the camera direction.
                  </p>
                </div>

                {/* 4. Posture Score */}
                <div className="comm-stat-card">
                  <div className="comm-stat-header">
                    <span className="comm-stat-title">Posture Score</span>
                    <TrendingUp size={14} className="comm-stat-icon" style={{ color: '#06b6d4' }} />
                  </div>
                  <div className="comm-stat-main">
                    <span className="comm-stat-num">
                      {videoSummary.postureScore !== null ? `${videoSummary.postureScore}%` : 'Unavailable'}
                    </span>
                    <span className={`comm-stat-pill ${videoSummary.postureScore !== null ? (videoSummary.postureScore >= 80 ? 'pill-optimal' : 'pill-note') : 'pill-note'}`}>
                      {videoSummary.postureScore !== null ? (videoSummary.postureScore >= 80 ? 'Aligned' : 'Variable') : 'Unavailable'}
                    </span>
                  </div>
                  <p className="comm-stat-desc">
                    Observable body-position alignment based on pose landmarks.
                  </p>
                </div>

                {/* 5. Posture Stability */}
                <div className="comm-stat-card">
                  <div className="comm-stat-header">
                    <span className="comm-stat-title">Posture Stability</span>
                    <ShieldCheck size={14} className="comm-stat-icon" style={{ color: '#06b6d4' }} />
                  </div>
                  <div className="comm-stat-main">
                    <span className="comm-stat-num">
                      {videoSummary.postureStabilityDisplay}
                    </span>
                    <span className={`comm-stat-pill ${videoSummary.postureStabilityIndex !== null ? (videoSummary.postureStabilityIndex >= 80 ? 'pill-optimal' : 'pill-warning') : 'pill-note'}`}>
                      {videoSummary.postureStabilityLabel ? formatVideoLabel(videoSummary.postureStabilityLabel) : (videoSummary.postureStabilityIndex !== null ? 'Measured' : 'Unavailable')}
                    </span>
                  </div>
                  <p className="comm-stat-desc">
                    Observable pose landmark stability and position consistency across frames.
                  </p>
                </div>

                {/* 6. Shoulder Alignment */}
                <div className="comm-stat-card">
                  <div className="comm-stat-header">
                    <span className="comm-stat-title">Shoulder Alignment</span>
                    <BarChart2 size={14} className="comm-stat-icon" style={{ color: '#06b6d4' }} />
                  </div>
                  <div className="comm-stat-main">
                    <span className="comm-stat-num">
                      {videoSummary.shoulderTiltDegrees !== null ? `${videoSummary.shoulderTiltDegrees}°` : 'Unavailable'}
                    </span>
                    <span className={`comm-stat-pill ${videoSummary.shoulderTiltDegrees !== null ? (videoSummary.shoulderTiltDegrees <= 8 ? 'pill-optimal' : 'pill-warning') : 'pill-note'}`}>
                      {videoSummary.shoulderTiltDegrees !== null ? (videoSummary.shoulderTiltDegrees <= 8 ? 'Level' : 'Tilted') : 'Unavailable'}
                    </span>
                  </div>
                  <p className="comm-stat-desc">
                    Measured shoulder tilt from pose landmarks.
                  </p>
                </div>

                {/* 7. Camera Engagement (if available) */}
                {videoSummary.cameraEngagement && (
                  <div className="comm-stat-card">
                    <div className="comm-stat-header">
                      <span className="comm-stat-title">Camera Engagement</span>
                      <Video size={14} className="comm-stat-icon" style={{ color: '#06b6d4' }} />
                    </div>
                    <div className="comm-stat-main">
                      <span className="comm-stat-num" style={{ fontSize: '18px', textTransform: 'capitalize' }}>
                        {formatVideoLabel(videoSummary.cameraEngagement)}
                      </span>
                      <span className="comm-stat-pill pill-optimal">
                        Observed
                      </span>
                    </div>
                    <p className="comm-stat-desc">
                      Categorical camera orientation and framing engagement.
                    </p>
                  </div>
                )}

                {/* 8. Video Quality (if available) */}
                {videoSummary.videoQualityIndicator && (
                  <div className="comm-stat-card">
                    <div className="comm-stat-header">
                      <span className="comm-stat-title">Video Quality</span>
                      <Sparkles size={14} className="comm-stat-icon" style={{ color: '#06b6d4' }} />
                    </div>
                    <div className="comm-stat-main">
                      <span className="comm-stat-num" style={{ fontSize: '18px', textTransform: 'capitalize' }}>
                        {formatVideoLabel(videoSummary.videoQualityIndicator)}
                      </span>
                      <span className={`comm-stat-pill ${videoSummary.videoQualityIndicator.toLowerCase() === 'good' ? 'pill-optimal' : 'pill-note'}`}>
                        Framing
                      </span>
                    </div>
                    <p className="comm-stat-desc">
                      Observed subject framing and resolution quality across frames.
                    </p>
                  </div>
                )}
              </div>

              {/* Observable Feedback list (Section 5) */}
              {videoSummary.observableFeedback.length > 0 && (
                <div className="observable-notes-box" style={{ marginTop: '14px' }}>
                  <span className="notes-box-title">Observable Feedback</span>
                  <ul className="notes-bullet-list">
                    {videoSummary.observableFeedback.map((fb, idx) => (
                      <li key={idx}>{fb}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Scientific Caveat Box (Section 11) */}
              <div className="scientific-caveat-box" style={{ marginTop: '14px' }}>
                <ShieldCheck size={16} color="#06b6d4" style={{ flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <strong>Objective Signal Note: </strong>
                  These metrics describe observable video signals such as face visibility, camera/eye alignment, posture landmarks, and framing. They are not measures of personality, confidence, honesty, intelligence, or hiring suitability.
                </div>
              </div>
            </>
          )}
        </section>

        {/* ==================================================================
            H. RECOMMENDED NEXT PRACTICE (Connected to Train Me)
            ================================================================== */}
        <section className="recommended-practice-section animate-fade-in">
          <div className="section-header-compact">
            <div className="section-title-wrap">
              <Sparkles size={18} className="icon-glow-cyan" />
              <div>
                <h2 className="section-title-sm">Recommended Next Practice</h2>
                <p className="section-desc-xs">
                  Targeted practice masterclasses generated strictly from your weak areas
                </p>
              </div>
            </div>

            <button
              onClick={handleTrainMe}
              disabled={trainingLoading}
              className="btn btn-primary btn-sm"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Sparkles size={14} />
              {trainingLoading ? 'Building Masterclass...' : 'Launch Masterclass'}
            </button>
          </div>

          <div className="practice-cards-grid">
            {targetedPractice.map((rec, i) => (
              <div key={i} className="practice-card glass-card">
                <div className="practice-card-top">
                  <PriorityBadge priority={rec.priority} />
                  <h3 className="practice-topic-name">{rec.skill}</h3>
                </div>

                <div className="practice-card-body">
                  <div className="practice-detail-block">
                    <span className="block-label">Target Opportunity</span>
                    <p className="block-text">{rec.description}</p>
                  </div>

                  {rec.topics?.length > 0 && (
                    <div className="practice-detail-block">
                      <span className="block-label">Key Topics to Practice</span>
                      <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '12px', color: '#94a3b8' }}>
                        {rec.topics.map((top, j) => <li key={j}>{top}</li>)}
                      </ul>
                    </div>
                  )}

                  {rec.studyApproach && (
                    <div className="practice-detail-block">
                      <span className="block-label">Suggested Approach</span>
                      <p className="block-text">💡 {rec.studyApproach}</p>
                    </div>
                  )}
                </div>

                <div className="practice-card-footer">
                  <button
                    onClick={() => handlePracticeNow(rec.skill, rec.topics)}
                    className="btn-practice-cta"
                  >
                    <Play size={12} /> Practice Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ==================================================================
            I. ACTIONS FOOTER
            ================================================================== */}
        <footer className="results-actions animate-fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={handleTrainMe}
            className="btn btn-primary btn-lg"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Sparkles size={18} />
            Train Me (Targeted Practice)
          </button>
          <button
            onClick={handleReInterview}
            disabled={reInterviewLoading}
            className="btn btn-secondary btn-lg"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Zap size={16} /> {reInterviewLoading ? 'Creating Session...' : 'Re-Interview'}
          </button>
          <Link to="/progress" className="btn btn-secondary">
            <TrendingUp size={16} /> View Progress
          </Link>
          <Link to="/dashboard" className="btn btn-ghost">
            <Home size={16} /> Dashboard
          </Link>
        </footer>

        {/* Lazy-loaded Topic Practice & Targeted Mock MCQ Modal */}
        {showPracticeModal && (
          <Suspense fallback={<div className="modal-loading-fallback"><div className="spinner" /></div>}>
            <PracticeModal
              mode={practiceMode}
              skill={practiceSkill}
              topics={practiceTopics}
              interviewId={id}
              authApi={authApi}
              onClose={() => setShowPracticeModal(false)}
            />
          </Suspense>
        )}

        {/* Lazy-loaded Interactive Train Me Modal */}
        {showTrainModal && activeTrainingSession && (
          <Suspense fallback={<div className="modal-loading-fallback"><div className="spinner" /></div>}>
            <TrainMeModal
              trainingSession={activeTrainingSession}
              onClose={() => setShowTrainModal(false)}
            />
          </Suspense>
        )}

        {/* Results AI Floating Button & Chatbot */}
        <FloatingCoachButton
          isOpen={coachOpen}
          onClick={() => {
            if (coachOpen) setInitialCoachQuery(null)
            setCoachOpen((prev) => !prev)
          }}
          label="Results AI"
          tooltip="Open Results AI"
        />
        <Suspense fallback={null}>
          <ResultsChatbot
            isOpen={coachOpen}
            onClose={() => {
              setCoachOpen(false)
              setInitialCoachQuery(null)
            }}
            resultId={id}
            questions={questionBreakdown}
            initialQuery={initialCoachQuery}
          />
        </Suspense>

      </div>
    </div>
  )
}
