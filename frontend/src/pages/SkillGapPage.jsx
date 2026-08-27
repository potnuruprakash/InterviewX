import { useState, useEffect, useRef } from 'react'
import { useAuthApi } from '../services/api'
import { Loader2, AlertCircle, BarChart3, RefreshCw } from 'lucide-react'
import {
  SkillCoverageCard,
  SkillGapSummary,
  CandidateProfileCard,
  JobRequirementsCard,
} from '../components/phase2/Phase2Components'
import './SkillGapPage.css'

const TABS = [
  { id: 'gap', label: '📊 Skill Gap' },
  { id: 'candidate', label: '👤 Candidate Profile' },
  { id: 'job', label: '📋 Job Requirements' },
]

export default function SkillGapPage() {
  const {
    authApi,
    isLoaded,
    isSignedIn,
    analyzeResume,
    analyzeJob,
    runSkillAnalysis,
  } = useAuthApi()

  const [resumes, setResumes] = useState([])
  const [jobs, setJobs] = useState([])
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('gap')
  const [statusMsg, setStatusMsg] = useState(null)
  const fetchedRef = useRef(false)

  // Load resumes and jobs
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setFetching(false)
      return
    }
    if (fetchedRef.current) return
    fetchedRef.current = true

    let isMounted = true
    const load = async () => {
      setFetching(true)
      try {
        const [rRes, jRes] = await Promise.all([
          authApi.get('/api/resumes'),
          authApi.get('/api/jobs'),
        ])
        if (isMounted) {
          setResumes(rRes.data?.resumes || [])
          setJobs(jRes.data?.jobs || [])
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          console.warn('[SkillGapPage] Failed to load resumes/jobs:', err.message)
          setResumes([])
          setJobs([])
        }
      } finally {
        if (isMounted) setFetching(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [isLoaded, isSignedIn, authApi])

  const handleRunAnalysis = async () => {
    if (!selectedResumeId || !selectedJobId) {
      setError('Please select both a resume and a job description.')
      return
    }

    setLoading(true)
    setError(null)
    setAnalysis(null)

    try {
      // Step 1: Ensure resume is analyzed
      setStatusMsg('Analyzing resume...')
      try {
        await analyzeResume(selectedResumeId)
      } catch (e) {
        // May already be analyzed — continue
        if (!e.message?.includes('cached')) {
          console.warn('[SkillGap] Resume pre-analyze warning:', e.message)
        }
      }

      // Step 2: Ensure JD is analyzed
      setStatusMsg('Analyzing job description...')
      try {
        await analyzeJob(selectedJobId)
      } catch (e) {
        if (!e.message?.includes('cached')) {
          console.warn('[SkillGap] JD pre-analyze warning:', e.message)
        }
      }

      // Step 3: Run skill gap analysis
      setStatusMsg('Calculating skill gap...')
      const res = await runSkillAnalysis(selectedResumeId, selectedJobId)
      setAnalysis(res.data.skillAnalysis)
      setStatusMsg(null)
    } catch (err) {
      setError(err.message || 'Skill analysis failed.')
      setStatusMsg(null)
    } finally {
      setLoading(false)
    }
  }

  const selectedResume = resumes.find((r) => r._id === selectedResumeId)
  const selectedJob = jobs.find((j) => j._id === selectedJobId)

  return (
    <div className="skill-gap-page">
      <div className="container">
        {/* Header */}
        <div className="sgp-header animate-fade-in">
          <h1 className="sgp-title">Resume-to-JD Skill Analysis</h1>
          <p className="sgp-subtitle">
            Compare your resume against a job description to identify skill coverage and gaps.
          </p>
          <div className="sgp-notice">
            ℹ️ This analysis identifies skills found in your resume — absence does not mean you lack a skill.
          </div>
        </div>

        {fetching ? (
          <div className="sgp-state">
            <Loader2 size={36} className="spin" />
            <p>Loading your resumes and jobs...</p>
          </div>
        ) : (
          <>
            {/* Selector Panel */}
            <div className="sgp-selector animate-fade-in">
              <div className="sgp-selector-title">Select Resume & Job Description</div>
              <div className="sgp-selector-grid">
                <div>
                  <div className="sgp-select-label">Resume</div>
                  <select
                    className="sgp-select"
                    value={selectedResumeId}
                    onChange={(e) => { setSelectedResumeId(e.target.value); setAnalysis(null) }}
                  >
                    <option value="">— Select a resume —</option>
                    {resumes.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.originalName} {r.processingStatus === 'completed' ? '✓' : '(not analyzed)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="sgp-select-label">Job Description</div>
                  <select
                    className="sgp-select"
                    value={selectedJobId}
                    onChange={(e) => { setSelectedJobId(e.target.value); setAnalysis(null) }}
                  >
                    <option value="">— Select a job —</option>
                    {jobs.map((j) => (
                      <option key={j._id} value={j._id}>
                        {j.targetRole} {j.processingStatus === 'completed' ? '✓' : '(not analyzed)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div className="error-state" style={{ marginBottom: 16 }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button
                className="sgp-run-btn"
                onClick={handleRunAnalysis}
                disabled={loading || !selectedResumeId || !selectedJobId}
              >
                {loading
                  ? <><Loader2 size={16} className="spin" /> {statusMsg || 'Running...'}</>
                  : <><BarChart3 size={16} /> {analysis ? <><RefreshCw size={14} /> Re-run Analysis</> : 'Run Skill Analysis'}</>
                }
              </button>
            </div>

            {/* Results */}
            {analysis && (
              <div className="animate-fade-in">
                {/* Coverage Cards */}
                <div className="sgp-section" style={{ marginBottom: 24 }}>
                  <div className="sgp-section-title">📊 Skill Coverage Summary</div>
                  <SkillCoverageCard
                    coveragePercent={analysis.skillCoveragePercentage}
                    gapPercent={analysis.skillGapPercentage}
                  />
                  <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                    {analysis.matchedRequiredSkillCount} of {analysis.requiredSkillCount} required skills identified in resume
                  </div>
                </div>

                {/* Tabs */}
                <div className="sgp-tabs">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      className={`sgp-tab ${activeTab === tab.id ? 'active' : ''}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'gap' && (
                  <div className="sgp-section animate-fade-in">
                    <div className="sgp-section-title">Skill Matching Details</div>
                    <SkillGapSummary
                      matchedRequiredSkills={analysis.matchedRequiredSkills}
                      notIdentifiedRequiredSkills={analysis.notIdentifiedRequiredSkills}
                      matchedPreferredSkills={analysis.matchedPreferredSkills}
                      notIdentifiedPreferredSkills={analysis.notIdentifiedPreferredSkills}
                      additionalSkills={analysis.additionalSkills}
                      requiredSkillCount={analysis.requiredSkillCount}
                      matchedRequiredSkillCount={analysis.matchedRequiredSkillCount}
                    />
                  </div>
                )}

                {activeTab === 'candidate' && (
                  <div className="sgp-section animate-fade-in">
                    <div className="sgp-section-title">
                      Candidate Profile — {selectedResume?.originalName}
                    </div>
                    <CandidateProfileCard parsedData={analysis.candidateProfile} />
                  </div>
                )}

                {activeTab === 'job' && (
                  <div className="sgp-section animate-fade-in">
                    <div className="sgp-section-title">
                      Job Requirements — {selectedJob?.targetRole}
                    </div>
                    <JobRequirementsCard parsedData={analysis.jobProfile} targetRole={selectedJob?.targetRole} />
                  </div>
                )}

                {/* Analysis metadata */}
                <div style={{ textAlign: 'right', marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                  Analysis v{analysis.analysisVersion} · {new Date(analysis.analyzedAt).toLocaleString()}
                </div>
              </div>
            )}

            {!analysis && !loading && resumes.length === 0 && (
              <div className="sgp-state">
                <div className="sgp-state-icon">📄</div>
                <h3>No resumes uploaded</h3>
                <p>Upload a resume from the Create Interview flow to get started.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
