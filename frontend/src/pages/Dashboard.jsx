import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useAuthApi } from '../services/api'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import FloatingCoachButton from '../components/coach/FloatingCoachButton'
import AIAssistantDrawer from '../components/coach/AIAssistantDrawer'
import './Dashboard.css'

// Custom tooltip for chart
const ChartTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="dash-chart-tooltip">
        <div className="tooltip-role">{data.role}</div>
        <div className="tooltip-score">
          Score: <strong>{payload[0].value}/100</strong>
        </div>
        <div className="tooltip-date">{data.date}</div>
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const { user } = useUser()
  const { authApi, isLoaded, isSignedIn } = useAuthApi()
  const { isLight } = useTheme()

  const [interviews, setInterviews] = useState([])
  const [progressData, setProgressData] = useState([])
  const [summary, setSummary] = useState(null)
  const [latestResults, setLatestResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [coachOpen, setCoachOpen] = useState(false)

  const fetchedRef = useRef(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [interviewsRes, progressRes] = await Promise.all([
        authApi.get('/api/interviews'),
        authApi.get('/api/progress'),
      ])

      const fetchedInterviews = interviewsRes.data?.interviews || []
      const fetchedProgress = progressRes.data?.progress || []
      const fetchedSummary = progressRes.data?.summary || null

      setInterviews(fetchedInterviews)
      setProgressData(fetchedProgress)
      setSummary(fetchedSummary)

      // Fetch latest completed interview results for targeted next-step focus
      const latestCompleted = fetchedInterviews.find((i) => i.status === 'completed')
      if (latestCompleted) {
        try {
          const resultsRes = await authApi.get(`/api/interviews/${latestCompleted._id || latestCompleted.id}/results`)
          setLatestResults(resultsRes.data || null)
        } catch (resultsErr) {
          console.warn('[Dashboard] Could not fetch latest results detail:', resultsErr.message)
        }
      }
    } catch (err) {
      console.warn('[Dashboard] Fetch error:', err.message)
      if (
        err.message?.includes('401') ||
        err.message?.toLowerCase().includes('sign in') ||
        err.message?.toLowerCase().includes('unauthorized') ||
        err.message?.toLowerCase().includes('session')
      ) {
        setError('Your session could not be verified. Please sign in again.')
      } else if (
        err.message?.includes('429') ||
        err.message?.toLowerCase().includes('too many requests')
      ) {
        setError('Too many requests. Please wait a moment before trying again.')
      } else if (err.message?.toLowerCase().includes('network error')) {
        setError('Backend server is unreachable. Please check that port 5000 and MongoDB are running.')
      } else {
        setError(err.message || 'Could not load your dashboard data.')
      }
    } finally {
      setLoading(false)
    }
  }, [authApi])

  const retryFetch = useCallback(() => {
    // Reset the guard so fetch can run again
    fetchedRef.current = false
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    if (fetchedRef.current) return
    fetchedRef.current = true

    fetchData()
  }, [isLoaded, isSignedIn, fetchData])

  // Real-time Greeting
  const firstName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'there'
  
  const getGreetingTime = () => {
    const hr = new Date().getHours()
    if (hr >= 5 && hr < 12) return 'morning'
    if (hr >= 12 && hr < 17) return 'afternoon'
    return 'evening' // 5:00 PM to 4:59 AM (including late night)
  }

  const [timeOfDay, setTimeOfDay] = useState(getGreetingTime)

  useEffect(() => {
    // Keep greeting synchronized with local real time
    const timer = setInterval(() => {
      setTimeOfDay(getGreetingTime())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  // Derived metrics
  const completedInterviews = useMemo(
    () => interviews.filter((i) => i.status === 'completed'),
    [interviews]
  )
  const inProgressCount = useMemo(
    () => interviews.filter((i) => i.status === 'in_progress').length,
    [interviews]
  )
  const latestCompleted = completedInterviews[0] || null

  const latestScore = summary?.latestScore != null ? Math.round(summary.latestScore) : null
  const bestScore = summary?.bestScore != null ? Math.round(summary.bestScore) : null
  const totalSessions = Math.max(summary?.totalInterviews || 0, interviews.length)

  // Consecutive Day Streak calculation
  const currentStreakDays = useMemo(() => {
    if (completedInterviews.length === 0) return 0
    const daySet = new Set(
      completedInterviews.map((i) => new Date(i.createdAt).toISOString().split('T')[0])
    )
    let streak = 0
    const checkDate = new Date()
    const todayStr = checkDate.toISOString().split('T')[0]
    checkDate.setDate(checkDate.getDate() - 1)
    const yestStr = checkDate.toISOString().split('T')[0]

    let curr = daySet.has(todayStr) ? new Date() : daySet.has(yestStr) ? checkDate : null
    if (!curr) return 0

    while (daySet.has(curr.toISOString().split('T')[0])) {
      streak += 1
      curr.setDate(curr.getDate() - 1)
    }
    return streak
  }, [completedInterviews])

  // Chart Data: Restrained, chronological score trend
  const chartData = useMemo(() => {
    if (!progressData || progressData.length === 0) return []
    return progressData
      .slice()
      .reverse()
      .map((p, idx) => ({
        attempt: `Attempt ${idx + 1}`,
        overall: p.overallScore != null ? Math.round(p.overallScore) : null,
        role: p.targetRole || 'Interview',
        date: p.completedAt
          ? new Date(p.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : `Session ${idx + 1}`,
      }))
  }, [progressData])

  // Next Step recommendation extraction
  const recommendedFocus = useMemo(() => {
    if (latestResults?.personalizedPracticePlan?.recommendedFollowUp?.focusAreas?.length > 0) {
      return latestResults.personalizedPracticePlan.recommendedFollowUp.focusAreas.slice(0, 2).join(' + ')
    }
    if (latestResults?.topPriorityImprovements?.length > 0) {
      return latestResults.topPriorityImprovements[0].title
    }
    if (progressData.length > 0 && progressData[0]?.improvementAreas?.length > 0) {
      return progressData[0].improvementAreas.slice(0, 2).join(' + ')
    }
    return null
  }, [latestResults, progressData])

  const practiceTargetUrl = latestCompleted
    ? `/create-interview?practiceFrom=${latestCompleted._id || latestCompleted.id}`
    : '/create-interview'

  // Contextual Voice / Behavior Indicator
  const voiceMetrics = latestResults?.voiceMetrics
  const behaviorMetrics = latestResults?.behaviorMetrics
  const hasVoiceOrBehaviorData = Boolean(
    (voiceMetrics && voiceMetrics.audioDataAvailable) ||
    (behaviorMetrics && behaviorMetrics.videoDataAvailable)
  )

  // ── Loading Skeleton ──────────────────────────────────────────────────────
  if (!isLoaded || (loading && interviews.length === 0 && !error)) {
    return (
      <div className="dash-page">
        <div className="dash-container">
          <div className="dash-skeleton dash-skeleton-hero" />
          <div className="dash-stats-grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="dash-skeleton dash-skeleton-card" />
            ))}
          </div>
          <div className="dash-skeleton dash-skeleton-chart" />
        </div>
      </div>
    )
  }

  // ── Error View ────────────────────────────────────────────────────────────
  if (error && interviews.length === 0) {
    return (
      <div className="dash-page">
        <div className="dash-container">
          <div className="dash-error-box">
            <AlertCircle size={18} className="dash-error-icon" />
            <div>
              <h3>Performance data temporarily unavailable</h3>
              <p>{error}</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={retryFetch}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── New User Empty State ──────────────────────────────────────────────────
  if (interviews.length === 0) {
    return (
      <div className="dash-page">
        <div className="dash-container">
          <div className="dash-empty-state">
            <h1 className="dash-empty-title">Welcome to InterviewX</h1>
            <p className="dash-empty-desc">
              Complete your first interview to track your performance, identify improvement areas, and receive personalized recommendations.
            </p>
            <Link to="/create-interview" className="btn btn-primary" id="start-first-interview-btn">
              + Start Your First Interview
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Production SaaS Dashboard ─────────────────────────────────────────────
  return (
    <div className="dash-page">
      <div className="dash-container">

        {/* 1. Header: Welcome + Primary CTA */}
        <header className="dash-header">
          <div className="dash-header-left">
            <h1 className="dash-greeting">Good {timeOfDay}, {firstName}</h1>
            <p className="dash-subheading">Continue preparing for your next interview.</p>
          </div>
          <div className="dash-header-right">
            <Link to="/create-interview" className="btn btn-primary" id="dash-new-interview-btn">
              + Start New Interview
            </Link>
          </div>
        </header>

        {/* 2. Performance Summary (Compact Row) */}
        <section className="dash-stats-grid" aria-label="Performance Summary">
          <div className="dash-stat-card">
            <span className="dash-stat-label">Interviews</span>
            <div className="dash-stat-val">{totalSessions}</div>
            <span className="dash-stat-sub">
              {completedInterviews.length} completed
            </span>
          </div>

          <div className="dash-stat-card">
            <span className="dash-stat-label">Latest Score</span>
            <div className="dash-stat-val">
              {latestScore != null ? (
                <>
                  {latestScore}<span className="dash-stat-unit">/100</span>
                </>
              ) : (
                <span className="dash-stat-na">—</span>
              )}
            </div>
            <span className="dash-stat-sub">
              {latestScore != null ? (latestScore >= 70 ? 'Strong delivery' : 'Developing') : 'No attempts'}
            </span>
          </div>

          <div className="dash-stat-card">
            <span className="dash-stat-label">Best Score</span>
            <div className="dash-stat-val">
              {bestScore != null ? (
                <>
                  {bestScore}<span className="dash-stat-unit">/100</span>
                </>
              ) : (
                <span className="dash-stat-na">—</span>
              )}
            </div>
            <span className="dash-stat-sub">Personal benchmark</span>
          </div>

          <div className="dash-stat-card">
            <span className="dash-stat-label">Current Streak</span>
            <div className="dash-stat-val">
              {currentStreakDays > 0 ? (
                <>
                  {currentStreakDays} <span className="dash-stat-unit">days</span>
                </>
              ) : inProgressCount > 0 ? (
                <>
                  {inProgressCount} <span className="dash-stat-unit">active</span>
                </>
              ) : (
                <span className="dash-stat-na">0 days</span>
              )}
            </div>
            <span className="dash-stat-sub">
              {currentStreakDays > 0 ? 'Consistent practice' : (inProgressCount > 0 ? 'In progress' : 'Practice regularly')}
            </span>
          </div>
        </section>

        {/* 3. Performance (Single Restrained Chart) */}
        <section className="dash-panel dash-perf-panel">
          <div className="dash-panel-header">
            <div>
              <h2 className="dash-panel-title">Performance</h2>
              <span className="dash-panel-sub">Recent interview scores</span>
            </div>
            <Link to="/progress" className="dash-header-link">
              View Progress →
            </Link>
          </div>

          {chartData.length >= 2 ? (
            <div className="dash-chart-wrapper">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 4, left: -22 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isLight ? '#E2E5EA' : 'rgba(255, 255, 255, 0.05)'}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="attempt"
                    stroke={isLight ? '#667085' : '#64748b'}
                    tick={{ fill: isLight ? '#667085' : '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: isLight ? '#E2E5EA' : 'rgba(255, 255, 255, 0.07)' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke={isLight ? '#667085' : '#64748b'}
                    tick={{ fill: isLight ? '#667085' : '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    ticks={[0, 25, 50, 75, 100]}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="overall"
                    stroke={isLight ? '#6D4AFF' : '#7c3aed'}
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: isLight ? '#6D4AFF' : '#7c3aed', stroke: isLight ? '#FFFFFF' : '#0d0f17', strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: isLight ? '#8B5CF6' : '#a78bfa' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="dash-insufficient-state">
              <p>Complete more interviews to track your progress.</p>
            </div>
          )}
        </section>

        {/* 4. Next Step (One Compact Actionable Area) */}
        <section className="dash-panel dash-next-panel">
          <div className="dash-next-inner">
            <div className="dash-next-info">
              <span className="dash-eyebrow">NEXT STEP</span>
              <h3 className="dash-next-heading">Continue practicing for your next interview.</h3>
              {recommendedFocus && (
                <p className="dash-next-focus">
                  Recommended focus: <strong>{recommendedFocus}</strong>
                </p>
              )}
              {hasVoiceOrBehaviorData && latestCompleted && (
                <div className="dash-next-voice-hint">
                  <span>Voice & behavior analysis available from latest session</span>
                  <span className="dash-hint-sep">·</span>
                  <Link
                    to={`/interview/${latestCompleted._id || latestCompleted.id}/results`}
                    className="dash-link-subtle"
                  >
                    View Analysis →
                  </Link>
                </div>
              )}
            </div>
            <div className="dash-next-action">
              <Link to={practiceTargetUrl} className="btn btn-primary" id="dash-start-practice-btn">
                Start Practice →
              </Link>
            </div>
          </div>
        </section>

        {/* 5. Recent Interviews (Professional Compact Table) */}
        <section className="dash-panel dash-recent-panel">
          <div className="dash-panel-header">
            <div>
              <h2 className="dash-panel-title">Recent Interviews</h2>
            </div>
            {interviews.length > 5 && (
              <Link to="/progress" className="dash-header-link">
                View All →
              </Link>
            )}
          </div>

          <div className="dash-table-wrapper">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>ROLE</th>
                  <th>SCORE</th>
                  <th>DATE</th>
                  <th>STATUS</th>
                  <th className="dash-th-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {interviews.slice(0, 5).map((interview) => {
                  const invId = interview._id || interview.id
                  const isCompleted = interview.status === 'completed'
                  const isInProgress = interview.status === 'in_progress'
                  const progItem = progressData.find(
                    (p) => String(p.interviewId) === String(invId) || String(p.id) === String(invId)
                  )
                  const score = progItem?.overallScore != null ? Math.round(progItem.overallScore) : null

                  return (
                    <tr key={invId}>
                      <td className="dash-td-role">
                        <span className="dash-role-name">{interview.targetRole || 'Software Engineer'}</span>
                        <span className="dash-role-meta">
                          {interview.interviewType || 'Mixed'} · {interview.difficulty || 'Medium'}
                        </span>
                      </td>
                      <td className="dash-td-score">
                        {score != null ? (
                          <span className="dash-score-text">{score}/100</span>
                        ) : isCompleted ? (
                          <span className="dash-score-text">Evaluated</span>
                        ) : (
                          <span className="dash-score-empty">—</span>
                        )}
                      </td>
                      <td className="dash-td-date">
                        {new Date(interview.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="dash-td-status">
                        <span className={`dash-status-pill status-${interview.status}`}>
                          {interview.status === 'completed'
                            ? 'Completed'
                            : interview.status === 'in_progress'
                            ? 'In Progress'
                            : 'Draft'}
                        </span>
                      </td>
                      <td className="dash-td-actions">
                        {isCompleted ? (
                          <div className="dash-actions-group">
                            <Link to={`/interview/${invId}/results`} className="dash-action-btn">
                              View
                            </Link>
                            <Link
                              to={`/create-interview?practiceFrom=${invId}`}
                              className="dash-action-btn action-practice"
                            >
                              Reattempt with New Questions
                            </Link>
                          </div>
                        ) : isInProgress ? (
                          <Link to={`/interview/${invId}`} className="dash-action-btn action-primary">
                            Continue
                          </Link>
                        ) : (
                          <Link to={`/interview/${invId}`} className="dash-action-btn">
                            Start
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>
      <FloatingCoachButton
        isOpen={coachOpen}
        onClick={() => setCoachOpen((prev) => !prev)}
      />
      <AIAssistantDrawer
        isOpen={coachOpen}
        onClose={() => setCoachOpen(false)}
      />
    </div>
  )
}
