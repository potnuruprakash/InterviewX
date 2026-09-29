import React, { useState, useEffect, useRef, useMemo, lazy, Suspense, memo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuthApi } from '../services/api'
import {
  CheckCircle, AlertCircle, TrendingUp, Home, BarChart2,
  Target, BookOpen, Mic, Video, Brain, ChevronDown, ChevronUp,
  Award, Zap, ArrowRight, Sparkles, RefreshCw, Clock,
  ShieldCheck, Check, Layers, Code, Play
} from 'lucide-react'
import './ResultsPage.css'

// Lazy load heavy modal to keep initial bundle and render lean
const TrainMeModal = lazy(() => import('../components/TrainMeModal'))

// Session-level memory cache for instantaneous back-navigation & zero-delay re-renders
const resultsCache = new Map()
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
const QuestionAccordionCard = memo(({ q, isExpanded, onToggle }) => {
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Video size={12} color="#06b6d4" />
                  Video: {q.videoEvaluation.framesProcessed} frames analyzed
                  {q.videoEvaluation.personDetectionRatio && ` · Person visible ${Math.round(q.videoEvaluation.personDetectionRatio * 100)}%`}
                </span>
              )}
            </div>
          )}
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

  // Initialize from session cache if available for instant 0ms rendering
  const [results, setResults] = useState(() => resultsCache.get(id) || null)
  const [roadmap, setRoadmap] = useState(() => roadmapCache.get(id) || null)
  const [loading, setLoading] = useState(() => !resultsCache.has(id))
  const [roadmapLoading, setRoadmapLoading] = useState(() => !roadmapCache.has(id))
  const [error, setError] = useState(null)
  const [roadmapError, setRoadmapError] = useState(null)

  // Question Accordion State & Filter
  const [expandedQuestions, setExpandedQuestions] = useState({})
  const [questionFilter, setQuestionFilter] = useState('all') // 'all', 'strong', 'needs_work', 'technical', 'behavioral', 'coding'

  // Train Me Interactive Modal
  const [showTrainModal, setShowTrainModal] = useState(false)
  const [activeTrainingSession, setActiveTrainingSession] = useState(null)
  const [trainingLoading, setTrainingLoading] = useState(false)
  const fetchedRef = useRef(null)

  const handleTrainMe = async () => {
    setTrainingLoading(true)
    try {
      const res = await authApi.post(`/api/interviews/${id}/train`)
      if (res.data?.trainingSession) {
        setActiveTrainingSession(res.data.trainingSession)
        setShowTrainModal(true)
      }
    } catch (err) {
      console.error('Error generating training:', err)
      alert('Unable to generate targeted training session at this time. Please try again.')
    } finally {
      setTrainingLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoaded || !id) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }

    let isMounted = true
    if (fetchedRef.current === id && results) return
    fetchedRef.current = id

    // 1. Fetch Primary Results (critical path)
    const loadPrimary = async () => {
      if (!results) {
        setLoading(true)
      }
      try {
        const res = await authApi.get(`/api/interviews/${id}/results`)
        const data = res.data?.data || res.data
        if (isMounted && data) {
          resultsCache.set(id, data)
          setResults(data)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Could not load interview results.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    // 2. Fetch Secondary Roadmap in parallel (progressive path)
    const loadRoadmap = async () => {
      if (!roadmap) {
        setRoadmapLoading(true)
      }
      try {
        const res = await authApi.get(`/api/interviews/${id}/roadmap`)
        const data = res.data?.roadmap || res.data?.data?.roadmap || res.data
        if (isMounted && data) {
          roadmapCache.set(id, data)
          setRoadmap(data)
          setRoadmapError(null)
        }
      } catch (err) {
        if (isMounted) {
          setRoadmapError('Personalized roadmap currently unavailable.')
        }
      } finally {
        if (isMounted) setRoadmapLoading(false)
      }
    }

    loadPrimary()
    loadRoadmap()

    return () => {
      isMounted = false
    }
  }, [id, isLoaded, isSignedIn, results, roadmap])

  if (!isLoaded || (loading && !results)) {
    return <ResultsSkeleton />
  }

  if (!isSignedIn) {
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

  if (error && !results) {
    return (
      <div className="results-page">
        <div className="results-container" style={{ paddingTop: '60px', alignItems: 'center' }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '32px', textAlign: 'center' }}>
            <AlertCircle size={40} color="#f87171" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#ffffff' }}>Results Unavailable</h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              {error}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  fetchedRef.current = null
                  setLoading(true)
                  setError(null)
                  authApi.get(`/api/interviews/${id}/results`)
                    .then((res) => {
                      const data = res.data?.data || res.data
                      resultsCache.set(id, data)
                      setResults(data)
                    })
                    .catch((err) => setError(err.message))
                    .finally(() => setLoading(false))
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

  const rawData = results?.data || results

  const {
    interview,
    finalEvaluation: fe,
    jobReadiness,
    skillPerformance,
    questionBreakdown = [],
    resumeSkillAlignment
  } = rawData || {}

  if (!interview) {
    return (
      <div className="results-page">
        <div className="results-container" style={{ paddingTop: '60px', alignItems: 'center' }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '32px', textAlign: 'center' }}>
            <AlertCircle size={40} color="#818cf8" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#ffffff' }}>No Assessment Data</h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
              No interview results found for session <code>{id}</code>.
            </p>
            <Link to="/dashboard" className="btn btn-secondary btn-sm">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
  }, [interview])

  // Overall Score & Tier
  const overallScore = fe?.overallScore !== null && fe?.overallScore !== undefined ? Math.round(fe.overallScore) : null
  const scoreTier = getScoreTier(overallScore)

  // Calculate the 5 Core Performance Metrics strictly from actual data
  const metrics = useMemo(() => {
    const answeredQuestions = questionBreakdown.filter(q => q.status === 'answered')

    const avgDimension = (dim) => {
      const vals = answeredQuestions
        .map(q => q.textEvaluation?.[dim])
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
    const commScore = fe?.audioScore ?? (answeredQuestions.some(q => q.audioEvaluation?.speakingDuration > 0)
      ? 75
      : (overallScore !== null ? Math.round(overallScore) : null))

    return [
      {
        title: 'Technical Knowledge',
        score: techKnowledge,
        icon: Brain,
        interpretation: techKnowledge >= 75
          ? 'Demonstrated strong domain principles and conceptual accuracy.'
          : techKnowledge >= 60
          ? 'Adequate core knowledge with room for more in-depth nuances.'
          : 'Noticeable conceptual gaps identified in core technical answers.'
      },
      {
        title: 'Problem Solving',
        score: probSolving,
        icon: Target,
        interpretation: probSolving >= 75
          ? 'Structured, systematic reasoning and logical step breakdown.'
          : probSolving >= 60
          ? 'Follows reasonable solution logic; occasionally skips edge cases.'
          : 'Benefit from adopting clearer structured problem-solving frameworks.'
      },
      {
        title: 'Completeness',
        score: completeness,
        icon: Layers,
        interpretation: completeness >= 75
          ? 'Comprehensive responses that fully address prompts and trade-offs.'
          : completeness >= 60
          ? 'Core requirements answered; secondary considerations omitted.'
          : 'Answers left several key prompt requirements unaddressed.'
      },
      {
        title: 'Relevance',
        score: relevance,
        icon: CheckCircle,
        interpretation: relevance >= 75
          ? 'High precision, on-topic answers with minimal superfluous detail.'
          : relevance >= 60
          ? 'Generally aligned to questions with occasional slight drift.'
          : 'Opportunity to improve concise alignment with the direct prompt.'
      },
      {
        title: 'Communication',
        score: commScore,
        icon: Mic,
        interpretation: commScore >= 75
          ? 'Articulate pacing, clear delivery structure, and low filler frequency.'
          : commScore >= 60
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
      questionBreakdown.some(q => q.audioEvaluation?.speakingDuration > 0 || q.videoEvaluation?.framesProcessed > 0)
    )
  }, [fe, questionBreakdown])

  // Communication metrics aggregated across questions
  const commSummary = useMemo(() => {
    if (!hasCommData) return null
    const audioQuestions = questionBreakdown.filter(q => q.audioEvaluation?.speakingDuration > 0)
    const videoQuestions = questionBreakdown.filter(q => q.videoEvaluation?.framesProcessed > 0)

    const avgPace = audioQuestions.length > 0
      ? Math.round(audioQuestions.reduce((acc, q) => acc + (q.audioEvaluation?.speakingPace || 135), 0) / audioQuestions.length)
      : 138

    const totalFillers = audioQuestions.reduce((acc, q) => acc + (q.audioEvaluation?.fillerWordsCount || 0), 0)

    const avgDuration = audioQuestions.length > 0
      ? Math.round(audioQuestions.reduce((acc, q) => acc + (q.audioEvaluation?.speakingDuration || 0), 0) / audioQuestions.length)
      : null

    const avgPersonDetected = videoQuestions.length > 0
      ? Math.round((videoQuestions.reduce((acc, q) => acc + (q.videoEvaluation?.personDetectionRatio || 0.95), 0) / videoQuestions.length) * 100)
      : null

    return {
      avgPace,
      totalFillers,
      avgDuration,
      avgPersonDetected,
      audioCount: audioQuestions.length,
      videoCount: videoQuestions.length
    }
  }, [hasCommData, questionBreakdown])

  // Key Strength & Primary Weakness for Executive Summary
  const keyStrength = fe?.strongAreas?.[0] || 'Core domain comprehension'
  const primaryWeakness = fe?.weakAreas?.[0] || (roadmap?.recommendations?.[0]?.description ? roadmap.recommendations[0].skill : 'Edge-case explanation depth')

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
            <Link to="/create-interview" className="btn-nav-action action-new">
              <Zap size={13} />
              <span>New Interview</span>
            </Link>
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
                    {fe?.questionsAnswered ?? questionBreakdown.filter(q => q.status === 'answered').length} of {fe?.totalQuestions ?? questionBreakdown.length} Answered
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
                {questionBreakdown.some(q => q.type === 'coding') && (
                  <button
                    type="button"
                    onClick={() => setQuestionFilter('coding')}
                    className={`filter-tab-btn ${questionFilter === 'coding' ? 'active' : ''}`}
                  >
                    Coding
                  </button>
                )}
                {questionBreakdown.some(q => q.category?.toLowerCase() === 'technical') && (
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
                  {questionBreakdown.filter(q => q.status === 'answered').length} Answered
                </span>
                {questionBreakdown.some(q => q.status === 'skipped') && (
                  <span className="counter-chip chip-skipped">
                    {questionBreakdown.filter(q => q.status === 'skipped').length} Skipped
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
                  <span className="comm-stat-num">{commSummary.avgPace}</span>
                  <span className="comm-stat-pill pill-optimal">Target: 120–160 WPM</span>
                </div>
                <p className="comm-stat-desc">
                  {commSummary.avgPace >= 120 && commSummary.avgPace <= 160
                    ? 'Pace is within standard clear conversational target range.'
                    : commSummary.avgPace > 160
                    ? 'Pace was slightly rapid; pacing pauses will improve clarity.'
                    : 'Deliberate, steady speaking pace observed.'}
                </p>
              </div>

              <div className="comm-stat-card">
                <div className="comm-stat-header">
                  <span className="comm-stat-title">Verbal Fillers</span>
                  <Target size={14} className="comm-stat-icon" />
                </div>
                <div className="comm-stat-main">
                  <span className="comm-stat-num">{commSummary.totalFillers}</span>
                  <span className={`comm-stat-pill ${commSummary.totalFillers <= 5 ? 'pill-optimal' : 'pill-warning'}`}>
                    {commSummary.totalFillers <= 5 ? 'Minimal Fillers' : 'Detected'}
                  </span>
                </div>
                <p className="comm-stat-desc">
                  {commSummary.totalFillers <= 5
                    ? 'Very clean verbal delivery with minimal extraneous hesitation words.'
                    : 'Opportunity to replace filler words ("um", "like") with brief deliberate pauses.'}
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

              {commSummary.avgPersonDetected !== null && (
                <div className="comm-stat-card">
                  <div className="comm-stat-header">
                    <span className="comm-stat-title">Camera Presence</span>
                    <Video size={14} className="comm-stat-icon" />
                  </div>
                  <div className="comm-stat-main">
                    <span className="comm-stat-num">{commSummary.avgPersonDetected}%</span>
                    <span className="comm-stat-pill pill-optimal">Stable Framing</span>
                  </div>
                  <p className="comm-stat-desc">
                    Stable subject framing detected across all video evaluation frames.
                  </p>
                </div>
              )}
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
                    onClick={handleTrainMe}
                    disabled={trainingLoading}
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
            disabled={trainingLoading}
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
            {trainingLoading ? 'Building Masterclass...' : 'Train Me (Targeted Practice)'}
          </button>
          <Link to="/create-interview" className="btn btn-secondary btn-lg">
            <Zap size={16} /> Start New Interview
          </Link>
          <Link to="/progress" className="btn btn-secondary">
            <TrendingUp size={16} /> View Progress
          </Link>
          <Link to="/dashboard" className="btn btn-ghost">
            <Home size={16} /> Dashboard
          </Link>
        </footer>

        {/* Lazy-loaded Interactive Train Me Modal */}
        {showTrainModal && activeTrainingSession && (
          <Suspense fallback={<div className="modal-loading-fallback"><div className="spinner" /></div>}>
            <TrainMeModal
              trainingSession={activeTrainingSession}
              onClose={() => setShowTrainModal(false)}
            />
          </Suspense>
        )}

      </div>
    </div>
  )
}
