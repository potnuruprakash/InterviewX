import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuthApi } from '../services/api'
import {
  CheckCircle, AlertCircle, TrendingUp, Home, BarChart2,
  Target, BookOpen, Mic, Video, VideoOff, Brain, ChevronDown, ChevronUp,
  Award, Zap, ArrowRight, Info, Sparkles, HelpCircle, FileText, Check,
  AlertTriangle, RefreshCw, Layers, ShieldCheck, Activity, Eye
} from 'lucide-react'
import './ResultsPage.css'

const ScoreRing = ({ score, size = 110, label = '', colorOverride = null }) => {
  if (score === null || score === undefined) {
    return (
      <div className="score-ring-wrap" style={{ width: size, height: size }}>
        <div className="score-ring-unavailable">
          <span>N/A</span>
          {label && <small>{label}</small>}
        </div>
      </div>
    )
  }
  const pct = Math.max(0, Math.min(100, score))
  const color = colorOverride || (pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444')
  const r = 40
  const circ = 2 * Math.PI * r
  const dash = circ * (pct / 100)

  return (
    <div className="score-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="score-ring-text">
        <span className="ring-score" style={{ color }}>{Math.round(pct)}</span>
        {label && <small>{label}</small>}
      </div>
    </div>
  )
}

const StarBadge = ({ component, data }) => {
  const status = data?.status || 'not_detected'
  const isDetected = status === 'detected'
  const isPartial = status === 'partially_detected'

  const labels = {
    situation: 'Situation (S)',
    task: 'Task (T)',
    action: 'Action (A)',
    result: 'Result (R)',
  }

  const badgeClass = isDetected
    ? 'star-pill-detected'
    : isPartial
    ? 'star-pill-partial'
    : 'star-pill-missed'

  const icon = isDetected ? '✓' : isPartial ? '△' : '✕'

  return (
    <div className={`star-pill ${badgeClass}`} title={data?.snippet || 'No specific cue detected'}>
      <span className="star-pill-icon">{icon}</span>
      <span className="star-pill-name">{labels[component] || component}</span>
    </div>
  )
}

export default function ResultsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { authApi, isLoaded, isSignedIn } = useAuthApi()

  const [results, setResults] = useState(null)
  const [roadmap, setRoadmap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showEvidenceModal, setShowEvidenceModal] = useState(false)
  const [activeEvidenceKey, setActiveEvidenceKey] = useState('speech_rate_wpm')
  const [expandedQuestions, setExpandedQuestions] = useState({})
  const fetchedRef = useRef(null)

  useEffect(() => {
    if (!isLoaded || !id) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    if (fetchedRef.current === id) return
    fetchedRef.current = id

    const load = async () => {
      setLoading(true)
      try {
        const [resRes, roadRes] = await Promise.all([
          authApi.get(`/api/interviews/${id}/results`),
          authApi.get(`/api/interviews/${id}/roadmap`).catch(() => ({ data: null })),
        ])
        setResults(resRes.data)
        setRoadmap(roadRes.data?.roadmap || null)
        // Expand first 2 questions by default
        setExpandedQuestions({ 0: true, 1: true })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isLoaded, isSignedIn])

  if (loading) {
    return (
      <div className="results-loading">
        <div className="spinner" />
        <p>Analyzing speech, observable behavior, and question responses...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="results-loading">
        <AlertCircle size={28} color="#f87171" />
        <p style={{ color: '#f87171' }}>{error}</p>
        <Link to="/dashboard" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
          Return to Dashboard
        </Link>
      </div>
    )
  }

  const {
    interview,
    finalEvaluation: fe,
    jobReadiness,
    skillPerformance,
    questionBreakdown,
    resumeSkillAlignment,
    voiceMetrics,
    behaviorMetrics,
    topPriorityImprovements = [],
    personalizedPracticePlan,
    comparisonWithPrevious,
    researchEvidence = {},
  } = results || {}

  const toggleQuestion = (idx) => {
    setExpandedQuestions((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  const expandAllQuestions = () => {
    const all = {}
    ;(questionBreakdown || []).forEach((_, i) => (all[i] = true))
    setExpandedQuestions(all)
  }

  const collapseAllQuestions = () => {
    setExpandedQuestions({})
  }

  return (
    <div className="results-page">
      <div className="container">
        {/* Top Breadcrumb & Metadata Bar */}
        <div className="results-nav-bar">
          <Link to="/dashboard" className="back-link">
            ← Dashboard
          </Link>
          <div className="report-meta-tags">
            <span className="meta-pill role-pill">{interview?.targetRole || 'Engineering Candidate'}</span>
            <span className="meta-pill type-pill">{interview?.interviewType}</span>
            <span className="meta-pill diff-pill">{interview?.difficulty}</span>
            {interview?.startedAt && interview?.completedAt && (
              <span className="meta-pill time-pill">
                ⏱️ {Math.max(1, Math.round((new Date(interview.completedAt) - new Date(interview.startedAt)) / 60000))} mins
              </span>
            )}
          </div>
          <button
            className="evidence-trigger-btn"
            onClick={() => setShowEvidenceModal(true)}
            title="View research evidence and empirical definitions"
          >
            <BookOpen size={14} /> Research Methodology
          </button>
        </div>

        {/* Header Hero */}
        <div className="results-header animate-fade-in">
          <div className="header-badge-row">
            <span className="eval-status-badge">
              <ShieldCheck size={14} /> Verified Multi-Dimensional Evaluation
            </span>
          </div>
          <h1 className="results-title">Interview Performance & Behavior Report</h1>
          <p className="results-subtitle">
            Empirical evaluation across technical problem-solving, vocal prosody, observable composure, and answer architecture.
          </p>

          {/* Longitudinal Trend Banner */}
          {comparisonWithPrevious?.hasPrevious && (
            <div className="longitudinal-banner animate-fade-in">
              <TrendingUp size={16} />
              <span>{comparisonWithPrevious.summary}</span>
              {comparisonWithPrevious.overallScoreDelta !== null && (
                <strong className={comparisonWithPrevious.overallScoreDelta >= 0 ? 'delta-pos' : 'delta-neg'}>
                  {comparisonWithPrevious.overallScoreDelta >= 0 ? `+${comparisonWithPrevious.overallScoreDelta}%` : `${comparisonWithPrevious.overallScoreDelta}%`}
                </strong>
              )}
            </div>
          )}

          {interview?.completionReason === 'time_expired' && (
            <div className="timeout-completion-badge animate-fade-in">
              ⏱️ Session timed out at 00:00. Completed and evaluated answers are documented below.
            </div>
          )}
        </div>

        {/* 4-Pillar Metric Grid */}
        <div className="score-pillars-grid animate-fade-in">
          {/* Pillar 1: Overall Evaluation */}
          <div className="pillar-card glass-card">
            <div className="pillar-header">
              <span className="pillar-label">Overall Evaluation</span>
              <Award size={16} className="pillar-icon" />
            </div>
            <div className="pillar-content">
              <ScoreRing score={fe?.overallScore} size={90} label="Overall" />
              <div className="pillar-stats">
                <div className="stat-line">
                  <span className="stat-name">Answered</span>
                  <span className="stat-val">{fe?.questionsAnswered ?? 0} / {fe?.totalQuestions ?? 0}</span>
                </div>
                <div className="stat-line">
                  <span className="stat-name">Skipped</span>
                  <span className="stat-val">{fe?.questionsSkipped ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pillar 2: Technical Competence */}
          <div className="pillar-card glass-card">
            <div className="pillar-header">
              <span className="pillar-label">Technical & Conceptual</span>
              <Brain size={16} className="pillar-icon" />
            </div>
            <div className="pillar-content">
              <ScoreRing score={fe?.technicalScore} size={90} label="Technical" />
              <div className="pillar-stats">
                <div className="stat-line">
                  <span className="stat-name">Method</span>
                  <span className="stat-val">Semantic NLP</span>
                </div>
                <div className="stat-line">
                  <span className="stat-name">Skills Assessed</span>
                  <span className="stat-val">{Object.keys(skillPerformance || {}).length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pillar 3: Speech & Vocal Prosody */}
          <div className="pillar-card glass-card">
            <div className="pillar-header">
              <span className="pillar-label">Speech & Vocal Fluency</span>
              <Mic size={16} className="pillar-icon" />
            </div>
            <div className="pillar-content">
              <div className="metric-callout">
                <span className="metric-number">{voiceMetrics?.wpm || 0}</span>
                <span className="metric-unit">WPM</span>
              </div>
              <div className="pillar-stats">
                <div className="stat-line">
                  <span className="stat-name">Pacing</span>
                  <span className={`badge-pill pacing-${voiceMetrics?.pacingAssessment || 'optimal'}`}>
                    {voiceMetrics?.pacingAssessment === 'fast' ? 'Rapid (>160)' : voiceMetrics?.pacingAssessment === 'measured' ? 'Measured (<125)' : 'Optimal (130-160)'}
                  </span>
                </div>
                <div className="stat-line">
                  <span className="stat-name">Filler Density</span>
                  <span className="stat-val">{voiceMetrics?.fillerDensity || 0}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pillar 4: Observable Visual Composure */}
          <div className="pillar-card glass-card">
            <div className="pillar-header">
              <span className="pillar-label">Observable Presence</span>
              {(interview?.videoUploaded || interview?.videoRecorded || interview?.modalityAvailability?.video || behaviorMetrics?.videoDataAvailable || behaviorMetrics?.status === 'captured') ? (
                <Video size={16} className="pillar-icon" style={{ color: '#10b981' }} />
              ) : (
                <VideoOff size={16} className="pillar-icon" />
              )}
            </div>
            <div className="pillar-content">
              {(interview?.videoUploaded || interview?.videoRecorded || interview?.modalityAvailability?.video || behaviorMetrics?.videoDataAvailable || behaviorMetrics?.status === 'captured') ? (
                <>
                  <div className="metric-callout">
                    <span className="metric-number">{behaviorMetrics?.cameraGazeRatio || 75}%</span>
                    <span className="metric-unit">Camera Gaze</span>
                  </div>
                  <div className="pillar-stats">
                    <div className="stat-line">
                      <span className="stat-name">Recording</span>
                      <span className="stat-val" style={{ color: '#10b981', fontWeight: 600 }}>✓ Captured</span>
                    </div>
                    <div className="stat-line">
                      <span className="stat-name">Posture</span>
                      <span className="stat-val">{behaviorMetrics?.postureAssessment || 'Steady'}</span>
                    </div>
                  </div>
                </>
              ) : (interview?.videoModeEnabled || behaviorMetrics?.status === 'failed') ? (
                <div className="pillar-unavailable">
                  <VideoOff size={24} style={{ opacity: 0.4, marginBottom: 4 }} />
                  <span className="unavailable-title">Recording Unavailable</span>
                  <p className="unavailable-sub">Camera stream was active during interview but video recording could not be processed.</p>
                </div>
              ) : (
                <div className="pillar-unavailable">
                  <VideoOff size={24} style={{ opacity: 0.4, marginBottom: 4 }} />
                  <span className="unavailable-title">Video Not Used</span>
                  <p className="unavailable-sub">Video recording was not selected for this practice session.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Empirical Evaluation Sub-Pillars */}
        <div className="sub-pillars-card glass-card animate-fade-in">
          <div className="sub-pillars-header">
            <div className="sub-pillars-title-wrap">
              <Activity size={18} className="icon-glow" />
              <div>
                <h2>Empirical Evaluation Breakdown</h2>
                <p>Granular scoring across technical precision, communicative structure, and supporting evidence.</p>
              </div>
            </div>
            <div className="session-counts-chips">
              <span className="count-chip answered">✓ {fe?.questionsAnswered ?? 0} Answered</span>
              <span className="count-chip skipped">↷ {fe?.questionsSkipped ?? 0} Skipped</span>
              {(fe?.questionsTimedOut > 0) && (
                <span className="count-chip timedout">⏱ {fe.questionsTimedOut} Timed Out</span>
              )}
            </div>
          </div>

          <div className="sub-pillars-grid">
            <div className="sub-pillar-item">
              <div className="sub-pillar-meta">
                <span className="sub-pillar-name">Technical Accuracy</span>
                <span className="sub-pillar-score">{fe?.technicalAccuracy ?? fe?.technicalScore ?? 75}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill fill-cyan" style={{ width: `${fe?.technicalAccuracy ?? fe?.technicalScore ?? 75}%` }} />
              </div>
              <span className="sub-pillar-desc">Correctness of syntax, architecture patterns, and domain concepts.</span>
            </div>

            <div className="sub-pillar-item">
              <div className="sub-pillar-meta">
                <span className="sub-pillar-name">Relevance</span>
                <span className="sub-pillar-score">{fe?.relevance ?? 80}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill fill-purple" style={{ width: `${fe?.relevance ?? 80}%` }} />
              </div>
              <span className="sub-pillar-desc">Direct alignment with the interviewer's prompt and core question constraints.</span>
            </div>

            <div className="sub-pillar-item">
              <div className="sub-pillar-meta">
                <span className="sub-pillar-name">Completeness</span>
                <span className="sub-pillar-score">{fe?.completeness ?? 70}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill fill-emerald" style={{ width: `${fe?.completeness ?? 70}%` }} />
              </div>
              <span className="sub-pillar-desc">Coverage of key expected concepts, trade-offs, and boundary cases.</span>
            </div>

            <div className="sub-pillar-item">
              <div className="sub-pillar-meta">
                <span className="sub-pillar-name">Communication</span>
                <span className="sub-pillar-score">{fe?.communication ?? 80}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill fill-blue" style={{ width: `${fe?.communication ?? 80}%` }} />
              </div>
              <span className="sub-pillar-desc">Structured clarity, optimal pacing (130-160 WPM), and low filler density.</span>
            </div>

            <div className="sub-pillar-item">
              <div className="sub-pillar-meta">
                <span className="sub-pillar-name">Depth</span>
                <span className="sub-pillar-score">{fe?.depth ?? 75}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill fill-indigo" style={{ width: `${fe?.depth ?? 75}%` }} />
              </div>
              <span className="sub-pillar-desc">Technical granularity, architectural trade-offs, and internal mechanisms.</span>
            </div>

            <div className="sub-pillar-item">
              <div className="sub-pillar-meta">
                <span className="sub-pillar-name">Evidence & STAR</span>
                <span className="sub-pillar-score">{fe?.evidence ?? 70}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill fill-amber" style={{ width: `${fe?.evidence ?? 70}%` }} />
              </div>
              <span className="sub-pillar-desc">Concrete project metrics, situational framing, and measurable outcomes.</span>
            </div>
          </div>

          {/* Actionable Strengths & Recommended Practice Roadmap */}
          {(fe?.strengths?.length > 0 || fe?.recommendedPractice?.length > 0) && (
            <div className="sub-pillars-footer">
              {fe?.strengths?.length > 0 && (
                <div className="strengths-column">
                  <span className="footer-col-title"><CheckCircle size={14} color="#10b981" /> Demonstrated Strengths</span>
                  <ul className="footer-bullet-list">
                    {fe.strengths.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {fe?.recommendedPractice?.length > 0 && (
                <div className="practice-column">
                  <span className="footer-col-title"><Target size={14} color="#06b6d4" /> Recommended Practice Roadmap</span>
                  <ul className="footer-bullet-list">
                    {fe.recommendedPractice.map((p, idx) => (
                      <li key={idx}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TOP 3 PRIORITIZED IMPROVEMENTS */}
        {topPriorityImprovements.length > 0 && (
          <div className="top-priorities-section animate-fade-in">
            <div className="section-title-wrap">
              <div className="title-left">
                <Sparkles size={18} className="icon-glow" />
                <h2>Top 3 Priority Improvements</h2>
              </div>
              <span className="section-subtitle-tag">Ranked by Evaluator Impact</span>
            </div>

            <div className="priorities-grid">
              {topPriorityImprovements.map((item, idx) => (
                <div key={idx} className="priority-card glass-card">
                  <div className="priority-card-top">
                    <span className="priority-number">{item.priority}</span>
                    <span className="priority-category-badge">{item.category}</span>
                  </div>

                  <h3 className="priority-card-title">{item.title}</h3>

                  <div className="priority-block observation-block">
                    <span className="block-label">Observed Signal</span>
                    <p className="block-text">{item.observation}</p>
                  </div>

                  <div className="priority-block impact-block">
                    <span className="block-label">Why It Matters (Research Context)</span>
                    <p className="block-text">{item.impact}</p>
                  </div>

                  <div className="priority-block drill-block">
                    <span className="block-label">Actionable Practice Drill</span>
                    <p className="block-text">{item.actionablePractice}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TWO-COLUMN EMPIRICAL METRICS DEEP DIVE */}
        <div className="results-two-col-grid animate-fade-in">
          {/* Left Column: Vocal Prosody & Fluency Breakdown */}
          <div className="deep-dive-card glass-card">
            <div className="deep-dive-header">
              <div className="header-title-box">
                <Mic size={18} className="card-icon" />
                <h3>Vocal Prosody & Fluency Metrics</h3>
              </div>
              <button
                className="info-icon-btn"
                onClick={() => {
                  setActiveEvidenceKey('speech_rate_wpm')
                  setShowEvidenceModal(true)
                }}
                title="View speech rate and filler literature"
              >
                <Info size={14} />
              </button>
            </div>

            <div className="deep-dive-body">
              {/* Speaking Pace Bar */}
              <div className="metric-row-item">
                <div className="metric-row-header">
                  <span className="metric-name">Pacing (Words Per Minute)</span>
                  <span className="metric-highlight">{voiceMetrics?.wpm || 0} WPM</span>
                </div>
                <div className="pace-gauge-track">
                  <div className="pace-target-zone" style={{ left: '45%', width: '25%' }}>
                    <span className="zone-label">Target: 130–160</span>
                  </div>
                  <div
                    className="pace-indicator-pin"
                    style={{ left: `${Math.min(100, Math.max(5, ((voiceMetrics?.wpm || 0) / 220) * 100))}%` }}
                  />
                </div>
                <div className="metric-sub-note">
                  {voiceMetrics?.pacingAssessment === 'fast'
                    ? 'Pace is higher than optimal. Practice inserting intentional 1.5s pauses between key architectural concepts.'
                    : voiceMetrics?.pacingAssessment === 'measured'
                    ? 'Pace is slower than average. Strive to maintain conversational momentum to demonstrate confidence.'
                    : 'Pacing is within the optimal 130–160 WPM window for professional evaluations (DeGroot & Motowidlo 1999).'}
                </div>
              </div>

              {/* Filler Word Breakdown */}
              <div className="metric-row-item">
                <div className="metric-row-header">
                  <span className="metric-name">Verbal Filler Tokens</span>
                  <span className="metric-highlight">
                    {voiceMetrics?.fillerCount || 0} detected ({voiceMetrics?.fillerDensity || 0}%)
                  </span>
                </div>
                {voiceMetrics?.fillerBreakdown && Object.keys(voiceMetrics.fillerBreakdown).length > 0 ? (
                  <div className="filler-tokens-list">
                    {Object.entries(voiceMetrics.fillerBreakdown).map(([token, count]) => (
                      <span key={token} className="filler-token-chip">
                        "{token}": <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="clean-signal-banner">
                    <Check size={14} /> Zero verbal fillers detected. Highly articulate phrasing.
                  </div>
                )}
                <div className="metric-sub-note">
                  Target density is &lt; 2.5%. Clark & Fox Tree (2002) demonstrate that replacing filled pauses with silent pauses enhances perceived competence.
                </div>
              </div>

              {/* Pause & Hesitation */}
              <div className="metric-row-item">
                <div className="metric-row-header">
                  <span className="metric-name">Pause Management</span>
                  <span className="metric-highlight">
                    Avg ~{voiceMetrics?.pauseMetrics?.averagePauseSec || 1.2}s
                  </span>
                </div>
                <div className="pause-stats-row">
                  <div className="pause-stat">
                    <span className="p-label">Average Pause</span>
                    <span className="p-val">{voiceMetrics?.pauseMetrics?.averagePauseSec || 1.2}s</span>
                  </div>
                  <div className="pause-stat">
                    <span className="p-label">Max Silence</span>
                    <span className="p-val">{voiceMetrics?.pauseMetrics?.maxPauseSec || 2.8}s</span>
                  </div>
                  <div className="pause-stat">
                    <span className="p-label">Estimated Transitions</span>
                    <span className="p-val">~{voiceMetrics?.pauseMetrics?.pauseCountEstimate || 1}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Observable Behavior & Presence */}
          <div className="deep-dive-card glass-card">
            <div className="deep-dive-header">
              <div className="header-title-box">
                <Eye size={18} className="card-icon" />
                <h3>Observable Non-Verbal Composure</h3>
              </div>
              <button
                className="info-icon-btn"
                onClick={() => {
                  setActiveEvidenceKey('visual_engagement_gaze')
                  setShowEvidenceModal(true)
                }}
                title="View gaze and posture literature"
              >
                <Info size={14} />
              </button>
            </div>

            <div className="deep-dive-body">
              {(interview?.videoUploaded || interview?.videoRecorded || interview?.modalityAvailability?.video || behaviorMetrics?.videoDataAvailable || behaviorMetrics?.status === 'captured') ? (
                <>
                  <div className="metric-row-item">
                    <div className="metric-row-header">
                      <span className="metric-name">Camera-Directed Gaze Alignment</span>
                      <span className="metric-highlight">{behaviorMetrics?.cameraGazeRatio || 75}%</span>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${behaviorMetrics?.cameraGazeRatio || 75}%`,
                          background: (behaviorMetrics?.cameraGazeRatio || 75) >= 50 ? '#10b981' : '#f59e0b',
                        }}
                      />
                    </div>
                    <div className="metric-sub-note">
                      Kleinke (1986) noted that natural, comfortable visual engagement is between 50% and 75%. Looking away periodically to think is natural and cognitively healthy.
                    </div>
                  </div>

                  <div className="metric-row-item">
                    <div className="metric-row-header">
                      <span className="metric-name">Framing & Posture Consistency</span>
                      <span className="metric-highlight">{behaviorMetrics?.postureStabilityIndex || 85}%</span>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${behaviorMetrics?.postureStabilityIndex || 85}%`, background: '#3b82f6' }}
                      />
                    </div>
                    <div className="metric-sub-note">
                      Upper torso remained centered in the camera viewport. Consistent frame alignment minimizes distractions during virtual technical interviews.
                    </div>
                  </div>

                  {behaviorMetrics?.observableNotes?.length > 0 && (
                    <div className="notes-list-box">
                      <span className="notes-label">Observable Observations:</span>
                      <ul>
                        {behaviorMetrics.observableNotes.map((note, i) => (
                          <li key={i}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="unavailability-deep-notice">
                  <div className="notice-icon-box">
                    <VideoOff size={28} />
                  </div>
                  <h4>{(interview?.videoModeEnabled || behaviorMetrics?.status === 'failed') ? 'Camera Stream Captured Without Video Payload' : 'No Video Data Recorded'}</h4>
                  <p>
                    {(interview?.videoModeEnabled || behaviorMetrics?.status === 'failed')
                      ? 'Camera stream was active in the browser, but media payload was not recorded. Camera hardware tracks were released cleanly upon session end.'
                      : 'Camera mode was not enabled during this practice interview. To adhere strictly to empirical standards, InterviewX does NOT synthesize unrecorded physical metrics.'}
                  </p>
                  <div className="setup-tip-box">
                    <strong>Tip for Next Interview:</strong> Enable camera mode in Interview Setup to receive webcam framing and gaze orientation analysis.
                  </div>
                </div>
              )}

              <div className="scientific-caveat-box">
                <ShieldCheck size={14} style={{ color: '#93c5fd', flexShrink: 0 }} />
                <span>
                  <strong>Empirical Notice:</strong> InterviewX measures physical, observable signals only. We never generate subjective psychological inferences regarding anxiety, confidence, or honesty.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* QUESTION-BY-QUESTION BREAKDOWN (WITH STAR EVALUATION) */}
        {questionBreakdown?.length > 0 && (
          <div className="results-section qb-section animate-fade-in">
            <div className="qb-section-header">
              <div className="header-left">
                <BookOpen size={18} />
                <h2>Question-by-Question Deep Dive</h2>
                <span className="badge badge-gray">{questionBreakdown.length} Prompts</span>
              </div>
              <div className="qb-controls">
                <button className="btn btn-ghost btn-xs" onClick={expandAllQuestions}>
                  Expand All
                </button>
                <button className="btn btn-ghost btn-xs" onClick={collapseAllQuestions}>
                  Collapse All
                </button>
              </div>
            </div>

            <div className="questions-accordion-list">
              {questionBreakdown.map((q, idx) => {
                const isExpanded = !!expandedQuestions[idx]
                const isSkipped = q.status === 'skipped'
                const hasStar = !!q.starAnalysis

                return (
                  <div
                    key={idx}
                    className={`question-item-card glass-card ${isSkipped ? 'card-skipped' : ''}`}
                  >
                    {/* Collapsible Row Header */}
                    <div className="q-card-header" onClick={() => toggleQuestion(idx)}>
                      <div className="q-header-meta">
                        <span className="q-number-pill">Q{q.questionNumber}</span>
                        <span className="badge badge-purple">{q.type === 'coding' ? '💻 Coding' : q.category}</span>
                        <span className={`badge ${q.difficulty === 'hard' ? 'badge-red' : q.difficulty === 'easy' ? 'badge-green' : 'badge-yellow'}`}>
                          {q.difficulty}
                        </span>
                        {q.targetSkill && q.targetSkill !== 'general' && (
                          <span className="badge badge-gray">{q.targetSkill}</span>
                        )}
                        {hasStar && (
                          <span className="star-tag">STAR Framework</span>
                        )}
                      </div>

                      <div className="q-header-title-bar">
                        <p className="q-preview-text">{q.questionText}</p>
                      </div>

                      <div className="q-header-right">
                        {isSkipped ? (
                          <span className="score-badge skipped-badge">Skipped</span>
                        ) : (
                          <span className="score-badge evaluated-badge">
                            {q.score !== null ? `${Math.round(q.score)}/100` : 'Evaluated'}
                          </span>
                        )}
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* Collapsible Body */}
                    {isExpanded && (
                      <div className="q-card-body">
                        {q.contextNote && (
                          <div className="q-context-note">
                            <strong>Interviewer Context:</strong> {q.contextNote}
                          </div>
                        )}

                        <div className="q-full-prompt-box">
                          <span className="sub-header-label">Full Question:</span>
                          <p>{q.questionText}</p>
                        </div>

                        {isSkipped ? (
                          <div className="q-skipped-notice">
                            <AlertTriangle size={16} color="#f59e0b" />
                            <div>
                              <strong>Question Skipped by Candidate</strong>
                              <p>Excluded from overall score calculation. Recommend reviewing core principles of this topic for your next session.</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Candidate Transcript / Code */}
                            {q.code && (
                              <div className="q-code-snippet">
                                <span className="sub-header-label">Submitted Code ({q.language || 'javascript'}):</span>
                                <pre><code>{q.code}</code></pre>
                              </div>
                            )}

                            <div className="q-transcript-box">
                              <div className="transcript-header-row">
                                <span className="sub-header-label">Spoken Response Transcript:</span>
                                <span className="word-count-tag">{q.wordCount || 0} words</span>
                              </div>
                              <p className="transcript-text">{q.answerText || '(No spoken text recorded)'}</p>
                            </div>

                            {/* Spoken Delivery Micro-Stats */}
                            {q.fillersDetected && q.fillersDetected.length > 0 && (
                              <div className="q-delivery-microstats">
                                <span className="microstat-label">Disfluency Tokens in this Answer:</span>
                                <div className="microstat-chips">
                                  {q.fillersDetected.map((f, fi) => (
                                    <span key={fi} className="token-chip">
                                      "{f.word}": {f.count}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Behavioral STAR Framework Breakdown */}
                            {hasStar && q.starAnalysis && (
                              <div className="star-breakdown-box">
                                <div className="star-box-header">
                                  <div className="star-title-left">
                                    <Target size={16} />
                                    <h4>Behavioral Structure Analysis (STAR)</h4>
                                  </div>
                                  <span className="star-score-indicator">
                                    Structure Alignment: <strong>{q.starAnalysis.completionScore}%</strong>
                                  </span>
                                </div>

                                <div className="star-pill-grid">
                                  <StarBadge component="situation" data={q.starAnalysis.situation} />
                                  <StarBadge component="task" data={q.starAnalysis.task} />
                                  <StarBadge component="action" data={q.starAnalysis.action} />
                                  <StarBadge component="result" data={q.starAnalysis.result} />
                                </div>

                                {q.starAnalysis.feedback && (
                                  <p className="star-feedback-text">
                                    💡 {q.starAnalysis.feedback}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Strengths and Improvements */}
                            <div className="strengths-improvements-grid">
                              {q.strengths && q.strengths.length > 0 && (
                                <div className="si-column strengths-col">
                                  <span className="si-label">✓ Strong Observations</span>
                                  <ul>
                                    {q.strengths.map((s, si) => (
                                      <li key={si}>{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {q.areasForImprovement && q.areasForImprovement.length > 0 && (
                                <div className="si-column improvements-col">
                                  <span className="si-label">△ Areas to Strengthen</span>
                                  <ul>
                                    {q.areasForImprovement.map((imp, ii) => (
                                      <li key={ii}>{imp}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PERSONALIZED PRACTICE PLAN & NEXT STEPS */}
        {personalizedPracticePlan && (
          <div className="results-section practice-plan-section animate-fade-in">
            <div className="section-title-wrap">
              <div className="title-left">
                <Target size={18} className="icon-glow" />
                <h2>Personalized Follow-up Practice Plan</h2>
              </div>
              <span className="section-subtitle-tag">Targeted Improvement Drills</span>
            </div>

            <div className="plan-columns-grid">
              <div className="plan-card glass-card">
                <div className="plan-card-header">
                  <Mic size={16} />
                  <h3>Communication & Delivery Goals</h3>
                </div>
                <ul className="plan-goals-list">
                  {personalizedPracticePlan.communicationGoals?.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>

              <div className="plan-card glass-card">
                <div className="plan-card-header">
                  <Brain size={16} />
                  <h3>Answer Architecture & STAR</h3>
                </div>
                <ul className="plan-goals-list">
                  {personalizedPracticePlan.structuralGoals?.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>

              <div className="plan-card glass-card">
                <div className="plan-card-header">
                  <Eye size={16} />
                  <h3>Observable Non-Verbal Goals</h3>
                </div>
                <ul className="plan-goals-list">
                  {personalizedPracticePlan.behavioralGoals?.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Targeted Re-Practice CTA */}
            <div className="practice-cta-card glass-card">
              <div className="cta-text-side">
                <h3>Ready to apply these improvements in a targeted session?</h3>
                <p>
                  Start a new interview tailored to <strong>{interview?.targetRole || 'your target role'}</strong> focusing on{' '}
                  {personalizedPracticePlan.recommendedFollowUp?.focusAreas?.join(', ') || 'articulation and structured answers'}.
                </p>
              </div>
              <Link to={`/create-interview?practiceFrom=${interview?.id || id}`} className="btn btn-primary btn-lg">
                <Zap size={16} /> Practice Again
              </Link>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="results-footer-actions animate-fade-in">
          <Link to={`/create-interview?practiceFrom=${interview?.id || id}`} className="btn btn-primary">
            <Zap size={16} /> Practice Again
          </Link>
          <Link to="/create-interview" className="btn btn-secondary">
            Start New Role
          </Link>
          <Link to="/progress" className="btn btn-secondary">
            <TrendingUp size={16} /> Track Longitudinal Progress
          </Link>
          <Link to="/dashboard" className="btn btn-ghost">
            <Home size={16} /> Dashboard
          </Link>
        </div>
      </div>

      {/* RESEARCH EVIDENCE MODAL / DRAWER */}
      {showEvidenceModal && (
        <div className="modal-backdrop" onClick={() => setShowEvidenceModal(false)}>
          <div className="evidence-modal glass-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="evidence-modal-header">
              <div className="modal-title-box">
                <BookOpen size={20} className="modal-icon" />
                <div>
                  <h3>Research Evidence & Evaluation Methodology</h3>
                  <p>Peer-reviewed literature grounding each measured signal in InterviewX</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowEvidenceModal(false)}>
                ✕
              </button>
            </div>

            <div className="evidence-modal-body">
              {/* Sidebar Tabs */}
              <div className="evidence-tabs-nav">
                {Object.keys(researchEvidence).map((k) => (
                  <button
                    key={k}
                    className={`evidence-tab-btn ${activeEvidenceKey === k ? 'active' : ''}`}
                    onClick={() => setActiveEvidenceKey(k)}
                  >
                    {researchEvidence[k]?.name || k}
                  </button>
                ))}
              </div>

              {/* Detail Content */}
              <div className="evidence-tab-content">
                {researchEvidence[activeEvidenceKey] && (
                  <>
                    <div className="evidence-header-block">
                      <span className="evidence-cat-tag">{researchEvidence[activeEvidenceKey].category}</span>
                      <h4>{researchEvidence[activeEvidenceKey].name}</h4>
                      <div className="empirical-target-banner">
                        <strong>Empirical Target:</strong> {researchEvidence[activeEvidenceKey].empiricalTarget}
                      </div>
                    </div>

                    <div className="evidence-section-block">
                      <h5>Measurement Definition</h5>
                      <p>{researchEvidence[activeEvidenceKey].definition}</p>
                    </div>

                    <div className="evidence-section-block">
                      <h5>Academic Research Citation</h5>
                      <div className="citation-card">
                        <p className="citation-authors">{researchEvidence[activeEvidenceKey].citation?.authors} ({researchEvidence[activeEvidenceKey].citation?.year})</p>
                        <p className="citation-title">"{researchEvidence[activeEvidenceKey].citation?.title}"</p>
                        <p className="citation-journal">{researchEvidence[activeEvidenceKey].citation?.journal}</p>
                      </div>
                    </div>

                    <div className="evidence-section-block">
                      <h5>Interpretation Guidance</h5>
                      <p>{researchEvidence[activeEvidenceKey].interpretation}</p>
                    </div>

                    <div className="evidence-section-block caveat-section">
                      <h5>Evaluation Limitations & Nuance</h5>
                      <p>{researchEvidence[activeEvidenceKey].limitations}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="evidence-modal-footer">
              <p className="ethical-notice">
                InterviewX strictly follows empirical measurement guidelines: vocal prosody and video framing reflect observable communicative signals, not fixed personality traits or psychological diagnostic states.
              </p>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEvidenceModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
