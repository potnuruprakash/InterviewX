import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthApi } from '../services/api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import { TrendingUp, AlertCircle, PlusCircle, Mic, Video, BarChart2, CheckCircle } from 'lucide-react'
import './ProgressPage.css'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="chart-tooltip">
        <div className="tooltip-label">Attempt {label}</div>
        <div className="tooltip-score">{payload[0].value}/100</div>
        {payload[0].payload.isDevelopmentEvaluation && (
          <div className="tooltip-dev">Dev Score</div>
        )}
      </div>
    )
  }
  return null
}

export default function ProgressPage() {
  const { authApi, isLoaded, isSignedIn } = useAuthApi()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    if (fetchedRef.current) return
    fetchedRef.current = true

    setLoading(true)
    authApi.get('/api/progress')
      .then(res => setData(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [isLoaded, isSignedIn])

  if (!isLoaded || (loading && !data)) return (
    <div className="progress-loading"><div className="spinner" /></div>
  )

  const { progress = [], summary } = data || {}

  // Build aggregate skill scores across all sessions
  const allSkillScores = {}
  for (const p of progress) {
    for (const [skill, score] of Object.entries(p.skillScores || {})) {
      if (!allSkillScores[skill]) allSkillScores[skill] = []
      allSkillScores[skill].push(score)
    }
  }
  const skillRadarData = Object.entries(allSkillScores)
    .map(([skill, scores]) => ({
      skill,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  // Count modalities used
  const modalityCounts = { text: 0, audio: 0, video: 0 }
  for (const p of progress) {
    for (const m of (p.modalitiesUsed || ['text'])) {
      modalityCounts[m] = (modalityCounts[m] || 0) + 1
    }
  }

  // Collect all improvement areas across sessions
  const allImprovements = {}
  for (const p of progress) {
    for (const area of (p.improvementAreas || [])) {
      allImprovements[area] = (allImprovements[area] || 0) + 1
    }
  }
  const topImprovements = Object.entries(allImprovements)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area]) => area)

  const allStrongAreas = {}
  for (const p of progress) {
    for (const area of (p.strongAreas || [])) {
      allStrongAreas[area] = (allStrongAreas[area] || 0) + 1
    }
  }
  const topStrong = Object.entries(allStrongAreas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area]) => area)

  return (
    <div className="progress-page">
      <div className="container">
        <div className="progress-header animate-fade-in">
          <div>
            <h1 className="progress-title">Progress Tracker</h1>
            <p className="progress-subtitle">Track your interview performance over time.</p>
          </div>
          <Link to="/create-interview" className="btn btn-primary">
            <PlusCircle size={16} /> New Interview
          </Link>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="progress-stats animate-fade-in">
            <div className="p-stat glass-card">
              <span className="p-stat-val">{summary.totalInterviews}</span>
              <span className="p-stat-label">Total Sessions</span>
            </div>
            <div className="p-stat glass-card">
              <span className="p-stat-val">{summary.latestScore ?? '—'}</span>
              <span className="p-stat-label">Latest Score</span>
            </div>
            <div className="p-stat glass-card">
              <span className="p-stat-val">{summary.bestScore ?? '—'}</span>
              <span className="p-stat-label">Best Score</span>
            </div>
            <div className="p-stat glass-card">
              <span className="p-stat-val">
                {progress.filter(p => (p.modalitiesUsed || []).includes('audio')).length}
              </span>
              <span className="p-stat-label"><Mic size={12} /> Audio Sessions</span>
            </div>
            <div className="p-stat glass-card">
              <span className="p-stat-val">
                {progress.filter(p => (p.modalitiesUsed || []).includes('video')).length}
              </span>
              <span className="p-stat-label"><Video size={12} /> Video Sessions</span>
            </div>
          </div>
        )}

        {/* Score Trend + Skill Radar (side-by-side) */}
        <div className="progress-charts-grid">
          {/* Score Trend */}
          {summary?.trend && summary.trend.length > 1 && (
            <div className="chart-card glass-card animate-fade-in">
              <h2 className="chart-title"><TrendingUp size={18} /> Score Trend</h2>
              {progress.some(p => p.isDevelopmentEvaluation) && (
                <div className="dev-notice">
                  ⚠️ Some sessions used baseline evaluation heuristics (AI service not connected).
                </div>
              )}
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={summary.trend} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="attempt"
                    stroke="#64748b"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone" dataKey="score"
                    stroke="url(#scoreGrad)" strokeWidth={3}
                    dot={{ fill: '#7c3aed', r: 5 }} activeDot={{ r: 7, fill: '#06b6d4' }}
                  />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7c3aed" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Skill Radar */}
          {skillRadarData.length >= 3 && (
            <div className="chart-card glass-card animate-fade-in">
              <h2 className="chart-title"><BarChart2 size={18} /> Skill Performance</h2>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={skillRadarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Radar name="Score" dataKey="score" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Strong / Improvement Areas */}
        {(topStrong.length > 0 || topImprovements.length > 0) && (
          <div className="areas-grid animate-fade-in">
            {topStrong.length > 0 && (
              <div className="area-panel glass-card">
                <h3><CheckCircle size={14} style={{ color: '#10b981' }} /> Consistent Strengths</h3>
                {topStrong.map((s, i) => (
                  <div key={i} className="area-pill area-strong">{s}</div>
                ))}
              </div>
            )}
            {topImprovements.length > 0 && (
              <div className="area-panel glass-card">
                <h3><AlertCircle size={14} style={{ color: '#f59e0b' }} /> Recurring Improvement Areas</h3>
                {topImprovements.map((s, i) => (
                  <div key={i} className="area-pill area-improve">{s}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Table */}
        {progress.length === 0 ? (
          <div className="empty-state glass-card animate-fade-in">
            <TrendingUp size={48} style={{ color: 'var(--text-muted)' }} />
            <h3>No interviews yet</h3>
            <p>Complete your first interview to see progress here.</p>
            <Link to="/create-interview" className="btn btn-primary">Start First Interview</Link>
          </div>
        ) : (
          <div className="history-section animate-fade-in">
            <h2 className="section-heading">Interview History</h2>
            <div className="history-table glass-card">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Difficulty</th>
                    <th>Qs</th>
                    <th>Score</th>
                    <th>Modalities</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.map((p, i) => (
                    <tr key={p.id}>
                      <td className="attempt-num">{i + 1}</td>
                      <td>{p.targetRole}</td>
                      <td><span className="badge badge-purple">{p.interviewType}</span></td>
                      <td><span className={`badge ${p.difficulty === 'hard' ? 'badge-red' : p.difficulty === 'easy' ? 'badge-green' : 'badge-yellow'}`}>{p.difficulty}</span></td>
                      <td>{p.questionsAnswered}</td>
                      <td>
                        <span className={`score-pill ${p.overallScore >= 80 ? 'green' : p.overallScore >= 60 ? 'yellow' : 'red'}`}>
                          {p.overallScore ?? '—'}/100
                        </span>
                        {p.isDevelopmentEvaluation && <span className="badge badge-dev" style={{ marginLeft: 6 }}>Dev</span>}
                      </td>
                      <td>
                        <span className="modality-icons">
                          🔤
                          {(p.modalitiesUsed || []).includes('audio') && ' 🎤'}
                          {(p.modalitiesUsed || []).includes('video') && ' 📹'}
                        </span>
                      </td>
                      <td className="date-cell">{new Date(p.completedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
