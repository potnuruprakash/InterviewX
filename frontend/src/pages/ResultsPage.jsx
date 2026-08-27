import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuthApi } from '../services/api'
import {
  CheckCircle, AlertCircle, TrendingUp, Home, BarChart2,
  Target, BookOpen, Mic, Video, Brain, ChevronDown, ChevronUp,
  Award, Zap, ArrowRight
} from 'lucide-react'
import './ResultsPage.css'

const ScoreRing = ({ score, size = 120, label = '' }) => {
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
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
  const r = 44
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

const SkillBar = ({ skill, score, maxScore = 100 }) => {
  const pct = Math.max(0, Math.min(100, (score / maxScore) * 100))
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="skill-bar-row">
      <span className="skill-bar-name">{skill}</span>
      <div className="skill-bar-track">
        <div className="skill-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="skill-bar-score" style={{ color }}>{Math.round(score)}</span>
    </div>
  )
}

const PriorityBadge = ({ priority }) => {
  const colors = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' }
  return (
    <span className="priority-badge" style={{ background: `${colors[priority]}22`, color: colors[priority], border: `1px solid ${colors[priority]}44` }}>
      {priority}
    </span>
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
  const [expanded, setExpanded] = useState({})
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
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isLoaded, isSignedIn])

  if (loading) return (
    <div className="results-loading"><div className="spinner" /><p>Building your results...</p></div>
  )

  if (error) return (
    <div className="results-loading">
      <AlertCircle size={24} color="#f87171" />
      <p style={{ color: '#f87171' }}>{error}</p>
    </div>
  )

  const { interview, finalEvaluation: fe, jobReadiness, skillPerformance, questionBreakdown, resumeSkillAlignment } = results || {}

  const toggle = (key) => setExpanded((v) => ({ ...v, [key]: !v[key] }))

  return (
    <div className="results-page">
      <div className="container">
        {/* Header */}
        <div className="results-header animate-fade-in">
          <h1 className="results-title">Interview Results</h1>
          <p className="results-subtitle">
            {interview?.targetRole} · {interview?.interviewType} · {interview?.difficulty}
            {interview?.questionGenerationSource === 'personalized' && ' · ✨ Personalized'}
          </p>
          {fe?.isDevelopmentEvaluation && (
            <div className="dev-notice animate-fade-in">
              ⚠️ {fe.sbertEvaluated > 0
                ? `${fe.sbertEvaluated} questions evaluated with SBERT. ${fe.notice}`
                : 'SBERT AI service was unavailable. Scores use development placeholder (word-length heuristics). Connect the AI service for real evaluation.'}
            </div>
          )}
        </div>

        {/* Overall Score + Job Readiness */}
        <div className="results-hero animate-fade-in">
          <div className="hero-scores glass-card">
            <div className="hero-score-group">
              <ScoreRing score={fe?.overallScore} size={140} label="Overall" />
              {fe?.technicalScore !== null && fe?.technicalScore !== undefined && (
                <ScoreRing score={fe.technicalScore} size={90} label="Technical" />
              )}
            </div>
            <div className="hero-meta">
              <div className="hero-meta-row">
                <span className="meta-label">Questions Answered</span>
                <span className="meta-val">{fe?.questionsAnswered || 0}</span>
              </div>
              <div className="hero-meta-row">
                <span className="meta-label">Modalities Used</span>
                <span className="meta-val">{fe?.modalitiesUsed?.join(', ') || 'text'}</span>
              </div>
              <div className="hero-meta-row">
                <span className="meta-label">Interview Type</span>
                <span className="meta-val" style={{ textTransform: 'capitalize' }}>{interview?.interviewType}</span>
              </div>
              <div className="hero-meta-row">
                <span className="meta-label">Duration</span>
                <span className="meta-val">
                  {interview?.startedAt && interview?.completedAt
                    ? `${Math.round((new Date(interview.completedAt) - new Date(interview.startedAt)) / 60000)} min`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Job Readiness */}
          {jobReadiness && (
            <div className="job-readiness-card glass-card animate-fade-in">
              <div className="jr-header">
                <Award size={18} />
                <span>Job Readiness Indicator</span>
                <span className="badge badge-dev" title={jobReadiness.disclaimer}>Prototype</span>
              </div>
              <ScoreRing score={jobReadiness.score} size={110} label={jobReadiness.label} />
              <div className="jr-breakdown">
                <div className="jr-row">
                  <span>Resume-JD Alignment</span>
                  <span>{jobReadiness.breakdown?.resumeAlignmentScore ?? '—'}%</span>
                </div>
                <div className="jr-row">
                  <span>Interview Performance</span>
                  <span>{jobReadiness.breakdown?.interviewPerformanceScore ?? '—'}%</span>
                </div>
                <div className="jr-row">
                  <span>Completion</span>
                  <span>{jobReadiness.breakdown?.completionScore ?? '—'}%</span>
                </div>
              </div>
              <p className="jr-disclaimer">{jobReadiness.disclaimer}</p>
            </div>
          )}
        </div>

        {/* Skill Performance */}
        {skillPerformance && Object.keys(skillPerformance).length > 0 && (
          <div className="results-section glass-card animate-fade-in">
            <div className="section-header" onClick={() => toggle('skills')}>
              <h2><BarChart2 size={18} /> Skill Performance</h2>
              {expanded.skills ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            {(expanded.skills || true) && (
              <div className="skill-bars">
                {Object.entries(skillPerformance).sort((a, b) => b[1].score - a[1].score).map(([skill, perf]) => (
                  <SkillBar key={skill} skill={skill} score={perf.score} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Strong / Weak Areas */}
        <div className="results-two-col animate-fade-in">
          {fe?.strongAreas?.length > 0 && (
            <div className="area-card glass-card strong">
              <h3>✅ Strong Areas</h3>
              {fe.strongAreas.map((s, i) => (
                <div key={i} className="area-item">{s}</div>
              ))}
            </div>
          )}
          {fe?.weakAreas?.length > 0 && (
            <div className="area-card glass-card weak">
              <h3>⚠️ Areas to Improve</h3>
              {fe.weakAreas.map((s, i) => (
                <div key={i} className="area-item">{s}</div>
              ))}
            </div>
          )}
        </div>

        {/* Resume / JD Alignment */}
        {resumeSkillAlignment && (resumeSkillAlignment.matchedSkills?.length > 0 || resumeSkillAlignment.missingSkills?.length > 0) && (
          <div className="results-section glass-card animate-fade-in">
            <div className="section-header" onClick={() => toggle('alignment')}>
              <h2><Target size={18} /> Resume–JD Alignment</h2>
              {expanded.alignment ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            {expanded.alignment && (
              <div className="alignment-grid">
                {resumeSkillAlignment.matchedSkills?.length > 0 && (
                  <div>
                    <div className="alignment-label matched">✅ Matched Required Skills</div>
                    <div className="skill-chips">
                      {resumeSkillAlignment.matchedSkills.map((s, i) => (
                        <span key={i} className="chip chip-green">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {resumeSkillAlignment.missingSkills?.length > 0 && (
                  <div>
                    <div className="alignment-label missing">❌ Not Identified in Resume</div>
                    <div className="skill-chips">
                      {resumeSkillAlignment.missingSkills.map((s, i) => (
                        <span key={i} className="chip chip-red">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Improvement Roadmap */}
        {roadmap && (
          <div className="results-section glass-card animate-fade-in">
            <div className="section-header" onClick={() => toggle('roadmap')}>
              <h2><TrendingUp size={18} /> Improvement Roadmap</h2>
              {expanded.roadmap ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            {expanded.roadmap && (
              <div className="roadmap-section">
                <p className="roadmap-summary">{roadmap.summary}</p>
                {roadmap.recommendations?.map((rec, i) => (
                  <div key={i} className="roadmap-item">
                    <div className="roadmap-item-header">
                      <span className="roadmap-skill">{rec.skill}</span>
                      <PriorityBadge priority={rec.priority} />
                      <span className="badge badge-gray" style={{ fontSize: '10px' }}>{rec.area}</span>
                    </div>
                    <p className="roadmap-desc">{rec.description}</p>
                    {rec.topics?.length > 0 && (
                      <div className="roadmap-topics">
                        <span className="topics-label">Topics to study:</span>
                        <ul>
                          {rec.topics.map((t, j) => <li key={j}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                    {rec.studyApproach && (
                      <p className="roadmap-approach">💡 {rec.studyApproach}</p>
                    )}
                  </div>
                ))}
                <p className="roadmap-disclaimer">{roadmap.disclaimer}</p>
              </div>
            )}
          </div>
        )}

        {/* Question Breakdown */}
        {questionBreakdown?.length > 0 && (
          <div className="results-section animate-fade-in">
            <div className="section-header" onClick={() => toggle('questions')}>
              <h2><BookOpen size={18} /> Question-by-Question Analysis</h2>
              {expanded.questions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            {expanded.questions && (
              <div className="question-breakdown">
                {questionBreakdown.map((q, i) => (
                  <div key={i} className="qb-item glass-card">
                    <div className="qb-header">
                      <span className="qb-num">Q{q.questionNumber}</span>
                      <span className="badge badge-purple">{q.category}</span>
                      <span className={`badge ${q.difficulty === 'hard' ? 'badge-red' : q.difficulty === 'easy' ? 'badge-green' : 'badge-yellow'}`}>
                        {q.difficulty}
                      </span>
                      {q.targetSkill && q.targetSkill !== 'general' && (
                        <span className="badge badge-gray">{q.targetSkill}</span>
                      )}
                      <span className="qb-score">
                        {q.score !== null ? `${Math.round(q.score)}/100` : '—'}
                        {q.textEvaluation?.modelStatus === 'sbert_evaluated' && (
                          <span className="sbert-tag">SBERT</span>
                        )}
                      </span>
                    </div>

                    {q.contextNote && (
                      <p className="qb-context">{q.contextNote}</p>
                    )}

                    <p className="qb-question">{q.question}</p>
                    <div className="qb-answer">
                      <span className="qb-answer-label">Your answer:</span>
                      <p>{q.answerText || '(No answer provided)'}</p>
                    </div>

                    {q.textEvaluation?.strengths?.length > 0 && (
                      <div className="qb-concepts">
                        <span className="qb-concepts-label">✅ Covered:</span>
                        {q.textEvaluation.strengths.map((s, j) => (
                          <span key={j} className="concept-tag concept-covered">{s}</span>
                        ))}
                      </div>
                    )}

                    {q.textEvaluation?.missingConcepts?.length > 0 && (
                      <div className="qb-concepts">
                        <span className="qb-concepts-label">⚠️ Missed:</span>
                        {q.textEvaluation.missingConcepts.map((c, j) => (
                          <span key={j} className="concept-tag concept-missing">{c}</span>
                        ))}
                      </div>
                    )}

                    {(q.textEvaluation?.feedback || q.evaluation?.feedback) && (
                      <p className="qb-feedback">
                        {q.textEvaluation?.feedback || q.evaluation?.feedback}
                      </p>
                    )}

                    {/* Audio/Video indicators */}
                    {q.audioEvaluation?.audioFeaturesAvailable && (
                      <div className="qb-media">
                        <Mic size={12} /> Audio: {q.audioEvaluation.speakingDuration?.toFixed(1)}s speaking
                        {q.audioEvaluation.speechRate && ` · ~${q.audioEvaluation.speechRate} syllables/sec`}
                      </div>
                    )}
                    {q.videoEvaluation?.framesProcessed > 0 && (
                      <div className="qb-media">
                        <Video size={12} /> Video: {q.videoEvaluation.framesProcessed} frames ·{' '}
                        person detected {Math.round((q.videoEvaluation.personDetectionRatio || 0) * 100)}% of frames
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
            }
          </div>
        )}

        {/* Actions */}
        <div className="results-actions animate-fade-in">
          <Link to="/create-interview" className="btn btn-primary btn-lg">
            <Zap size={16} /> Start New Interview
          </Link>
          <Link to="/progress" className="btn btn-secondary">
            <TrendingUp size={16} /> View Progress
          </Link>
          <Link to="/dashboard" className="btn btn-ghost">
            <Home size={16} /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
