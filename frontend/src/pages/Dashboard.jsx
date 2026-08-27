import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useAuthApi } from '../services/api'
import {
  PlusCircle, Clock, TrendingUp, CheckCircle, AlertCircle,
  ChevronRight, Brain, RefreshCw, BarChart3, Sparkles
} from 'lucide-react'
import './Dashboard.css'

export default function Dashboard() {
  const { user } = useUser()
  const { authApi, isLoaded, isSignedIn } = useAuthApi()
  const [interviews, setInterviews] = useState([])
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fetchedRef = useRef(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [interviewsRes, progressRes] = await Promise.all([
        authApi.get('/api/interviews'),
        authApi.get('/api/progress'),
      ])
      setInterviews(interviewsRes.data?.interviews || [])
      setProgress(progressRes.data?.summary || null)
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
        err.message?.toLowerCase().includes('too many requests') ||
        err.message?.toLowerCase().includes('rate limit')
      ) {
        setError('Too many requests. Please wait a moment before trying again.')
      } else {
        setError(err.message || 'Could not load your interview sessions. Please try refreshing.')
      }
    } finally {
      setLoading(false)
    }
  }, [authApi])

  useEffect(() => {
    // Only execute API fetch once when Clerk has completely loaded and confirmed user is signed in
    if (!isLoaded) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    if (fetchedRef.current) return
    fetchedRef.current = true

    fetchData()
  }, [isLoaded, isSignedIn, fetchData])

  const firstName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'there'

  const statusBadge = (status) => {
    const map = {
      created: { label: 'Not Started', class: 'badge-gray' },
      in_progress: { label: 'In Progress', class: 'badge-yellow' },
      completed: { label: 'Completed', class: 'badge-green' },
      abandoned: { label: 'Abandoned', class: 'badge-red' },
    }
    const s = map[status] || { label: status, class: 'badge-gray' }
    return <span className={`badge ${s.class}`}>{s.label}</span>
  }

  if (!isLoaded || (loading && interviews.length === 0 && !error)) {
    return (
      <div className="dashboard-loading-screen">
        <div className="dashboard-loading-card glass-card">
          <div className="loading-logo">
            <Brain size={32} className="spin-pulse" />
          </div>
          <h3>Loading InterviewX...</h3>
          <p>Preparing your interview workspace</p>
        </div>
      </div>
    )
  }

  const inProgressCount = interviews.filter((i) => i.status === 'in_progress').length
  const totalSessionsCount = Math.max(progress?.totalInterviews || 0, interviews.length)

  return (
    <div className="dashboard">
      <div className="container">
        {/* Welcome Header */}
        <div className="dashboard-header animate-fade-in">
          <div>
            <h1 className="dashboard-title">
              Welcome back, <span className="gradient-text">{firstName}</span> 👋
            </h1>
            <p className="dashboard-subtitle">
              Ready for your next InterviewX personalized practice session?
            </p>
          </div>
          <Link to="/create-interview" className="btn btn-primary btn-lg" id="dashboard-new-interview-btn">
            <PlusCircle size={18} />
            Start New Interview
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid animate-fade-in">
          <div className="stat-card glass-card">
            <div className="stat-icon stat-icon-purple"><Brain size={20} /></div>
            <div>
              <div className="stat-value">{totalSessionsCount}</div>
              <div className="stat-label">Total Sessions</div>
            </div>
          </div>
          <div className="stat-card glass-card">
            <div className="stat-icon stat-icon-cyan"><TrendingUp size={20} /></div>
            <div>
              <div className="stat-value">
                {progress?.latestScore != null ? `${progress.latestScore}/100` : '—'}
              </div>
              <div className="stat-label">Latest Score</div>
            </div>
          </div>
          <div className="stat-card glass-card">
            <div className="stat-icon stat-icon-green"><CheckCircle size={20} /></div>
            <div>
              <div className="stat-value">
                {progress?.bestScore != null ? `${progress.bestScore}/100` : '—'}
              </div>
              <div className="stat-label">Best Score</div>
            </div>
          </div>
          <div className="stat-card glass-card">
            <div className="stat-icon stat-icon-yellow"><Clock size={20} /></div>
            <div>
              <div className="stat-value">{inProgressCount}</div>
              <div className="stat-label">In Progress</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="dashboard-content">
          {/* Recent Interviews */}
          <div className="dashboard-section">
            <div className="section-header">
              <h2 className="section-heading">Recent Interviews</h2>
              {interviews.length > 0 && (
                <Link to="/progress" className="btn btn-ghost btn-sm">
                  View All <ChevronRight size={14} />
                </Link>
              )}
            </div>

            {error ? (
              <div className="error-state glass-card">
                <AlertCircle size={20} className="error-icon" />
                <span>{error}</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    fetchedRef.current = false
                    fetchData()
                  }}
                  style={{ marginLeft: 'auto' }}
                >
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            ) : interviews.length === 0 ? (
              <div className="empty-state glass-card animate-fade-in">
                <div className="empty-state-icon-wrap">
                  <Brain size={44} className="empty-icon" />
                </div>
                <h3 className="empty-state-title">No interviews yet</h3>
                <p className="empty-state-desc">
                  Start your first personalized interview to begin tracking your progress.
                </p>
                <Link to="/create-interview" className="btn btn-primary btn-lg">
                  <PlusCircle size={18} />
                  Start New Interview
                </Link>
              </div>
            ) : (
              <div className="interviews-list">
                {interviews.slice(0, 5).map((interview) => (
                  <div key={interview._id || interview.id} className="interview-card glass-card">
                    <div className="interview-card-info">
                      <div className="interview-role">{interview.targetRole}</div>
                      <div className="interview-meta">
                        <span className="badge badge-purple">{interview.interviewType}</span>
                        <span className="badge badge-cyan">{interview.difficulty}</span>
                        {statusBadge(interview.status)}
                        {interview.questionGenerationSource === 'personalized' && (
                          <span className="badge badge-green" title="Personalized from Resume & Job Description">
                            <Sparkles size={11} /> Personalized
                          </span>
                        )}
                      </div>
                      <div className="interview-date">
                        {new Date(interview.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className="interview-card-action">
                      {interview.status === 'completed' ? (
                        <Link
                          to={`/interview/${interview._id || interview.id}/results`}
                          className="btn btn-secondary btn-sm"
                        >
                          View Results
                        </Link>
                      ) : interview.status === 'in_progress' ? (
                        <Link
                          to={`/interview/${interview._id || interview.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          Continue
                        </Link>
                      ) : (
                        <Link
                          to={`/interview/${interview._id || interview.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          Start
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="dashboard-section">
            <h2 className="section-heading">Quick Actions</h2>
            <div className="quick-actions">
              <Link to="/create-interview" className="quick-action glass-card">
                <PlusCircle size={24} className="quick-action-icon purple" />
                <span className="quick-action-title">New Interview</span>
                <span className="quick-action-desc">Start a personalized session with AI</span>
              </Link>
              <Link to="/progress" className="quick-action glass-card">
                <TrendingUp size={24} className="quick-action-icon cyan" />
                <span className="quick-action-title">View Progress</span>
                <span className="quick-action-desc">Track your score improvement over time</span>
              </Link>
              <Link to="/skill-analysis" className="quick-action glass-card">
                <BarChart3 size={24} className="quick-action-icon green" />
                <span className="quick-action-title">Resume & JD Analysis</span>
                <span className="quick-action-desc">Analyze skill gaps against job requirements</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
