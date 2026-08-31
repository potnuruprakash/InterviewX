import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthApi } from '../services/api'
import {
  Upload, FileText, Briefcase, ChevronRight, AlertCircle,
  CheckCircle, Loader2, X, BarChart3, Settings
} from 'lucide-react'
import {
  CandidateProfileCard,
  JobRequirementsCard,
  SkillCoverageCard,
  SkillGapSummary,
} from '../components/phase2/Phase2Components'
import './CreateInterview.css'

const INTERVIEW_TYPES = [
  { value: 'mixed', label: 'Mixed', desc: 'Technical + Behavioral + HR' },
  { value: 'technical', label: 'Technical', desc: 'Coding & system design' },
  { value: 'behavioral', label: 'Behavioral', desc: 'Situational & soft skills' },
  { value: 'hr', label: 'HR', desc: 'Culture fit & motivation' },
]

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', desc: 'Entry level' },
  { value: 'medium', label: 'Medium', desc: 'Mid level' },
  { value: 'hard', label: 'Hard', desc: 'Senior level' },
]

const DURATIONS = [
  { value: 10, label: '10 min', desc: 'Quick check' },
  { value: 15, label: '15 min', desc: 'Express interview' },
  { value: 20, label: '20 min', desc: 'Short session' },
  { value: 30, label: '30 min', desc: 'Standard interview' },
  { value: 45, label: '45 min', desc: 'In-depth session' },
  { value: 60, label: '60 min', desc: 'Comprehensive' },
]

const STEPS = [
  { n: 1, label: 'Resume' },
  { n: 2, label: 'Resume Analysis' },
  { n: 3, label: 'Job Description' },
  { n: 4, label: 'Skill Gap' },
  { n: 5, label: 'Settings' },
  { n: 6, label: 'Review' },
]

export default function CreateInterview() {
  const navigate = useNavigate()
  const {
    authApi,
    analyzeResume,
    analyzeJob,
    runSkillAnalysis,
  } = useAuthApi()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  // Step 1 — Resume upload
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeId, setResumeId] = useState(null)
  const [resumeUploaded, setResumeUploaded] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(false)

  // Step 2 — Resume analysis
  const [resumeAnalysis, setResumeAnalysis] = useState(null)
  const [analyzeStatus, setAnalyzeStatus] = useState(null) // 'analyzing' | 'done' | 'failed'

  // Step 3 — Job Description
  const [jdContent, setJdContent] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [jobId, setJobId] = useState(null)

  // Step 4 — Skill Gap
  const [skillGapResult, setSkillGapResult] = useState(null)
  const [skillGapLoading, setSkillGapLoading] = useState(false)
  const [skillGapStatus, setSkillGapStatus] = useState(null)

  // Step 5 — Interview settings
  const [interviewType, setInterviewType] = useState('mixed')
  const [difficulty, setDifficulty] = useState('medium')
  const [totalQuestions, setTotalQuestions] = useState(10)
  const [durationMinutes, setDurationMinutes] = useState(30)

  // ─── File Handling ───────────────────────────────────────────────────────────

  const handleFileSelect = (file) => {
    if (!file) return
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (!allowed.includes(file.type)) {
      setError('Only PDF and DOCX files are supported.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10 MB.')
      return
    }
    setError(null)
    setResumeFile(file)
    setResumeUploaded(false)
    setResumeId(null)
    setResumeAnalysis(null)
    setAnalyzeStatus(null)
  }

  const handleUploadResume = async () => {
    if (!resumeFile) return
    setUploadProgress(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('resume', resumeFile)
      const res = await authApi.post('/api/resumes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResumeId(res.data.resume.id)
      setResumeUploaded(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadProgress(false)
    }
  }

  // ─── Step 2: Resume Analysis ─────────────────────────────────────────────────

  const handleAnalyzeResume = async () => {
    if (!resumeId) return
    setAnalyzeStatus('analyzing')
    setError(null)
    try {
      const res = await analyzeResume(resumeId)
      setResumeAnalysis(res.data.resume)
      setAnalyzeStatus('done')
    } catch (err) {
      setError(err.message || 'Resume analysis failed.')
      setAnalyzeStatus('failed')
    }
  }

  // ─── Step 3: Save JD ─────────────────────────────────────────────────────────

  const handleSaveJD = async () => {
    if (!jdContent.trim() || !targetRole.trim()) {
      setError('Please fill in both job description and target role.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await authApi.post('/api/jobs', { content: jdContent, targetRole })
      setJobId(res.data.job.id)
      setStep(4)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ─── Step 4: Skill Gap Analysis ──────────────────────────────────────────────

  const handleRunSkillGap = async () => {
    if (!resumeId || !jobId) return
    setSkillGapLoading(true)
    setError(null)
    setSkillGapResult(null)

    try {
      // Ensure JD is analyzed first
      setSkillGapStatus('Analyzing job description...')
      try { await analyzeJob(jobId) } catch (e) { /* may already be done */ }

      setSkillGapStatus('Calculating skill gap...')
      const res = await runSkillAnalysis(resumeId, jobId)
      setSkillGapResult(res.data.skillAnalysis)
      setSkillGapStatus(null)
    } catch (err) {
      setError(err.message || 'Skill gap analysis failed.')
      setSkillGapStatus(null)
    } finally {
      setSkillGapLoading(false)
    }
  }

  // ─── Step 6: Create Interview ─────────────────────────────────────────────────

  const handleCreateInterview = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authApi.post('/api/interviews', {
        resumeId,
        jobDescriptionId: jobId,
        interviewType,
        difficulty,
        totalQuestions,
        durationMinutes,
      })
      navigate(`/interview/${res.data.interview.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const goNext = () => { setError(null); setStep((s) => s + 1) }
  const goBack = () => { setError(null); setStep((s) => s - 1) }

  return (
    <div className="create-interview">
      <div className="container">
        {/* Page Header */}
        <div className="ci-header animate-fade-in">
          <h1 className="ci-title">Create Interview Session</h1>
          <p className="ci-subtitle">Set up your personalized AI interview in a few steps.</p>
        </div>

        {/* Step Indicator */}
        <div className="step-indicator animate-fade-in">
          {STEPS.map(({ n, label }) => (
            <div key={n} className={`step-item ${step >= n ? 'active' : ''} ${step > n ? 'done' : ''}`}>
              <div className="step-circle">
                {step > n ? <CheckCircle size={14} /> : n}
              </div>
              <span className="step-label">{label}</span>
              {n < 6 && <div className={`step-line ${step > n ? 'done' : ''}`} />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="ci-content">

          {/* ── STEP 1: Upload Resume ────────────────────────────────────────── */}
          {step === 1 && (
            <div className="ci-card glass-card animate-fade-in">
              <h2 className="ci-card-title"><FileText size={20} /> Upload Resume</h2>
              <p className="ci-card-desc">Upload your resume (PDF or DOCX, max 10 MB)</p>

              <div
                className={`drop-zone ${dragOver ? 'dragover' : ''} ${resumeFile ? 'has-file' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  handleFileSelect(e.dataTransfer.files[0])
                }}
                onClick={() => document.getElementById('resume-input').click()}
              >
                <input
                  id="resume-input"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                />
                {resumeFile ? (
                  <div className="drop-zone-file">
                    <FileText size={32} className="drop-icon green" />
                    <span className="drop-filename">{resumeFile.name}</span>
                    <span className="drop-filesize">{(resumeFile.size / 1024).toFixed(0)} KB</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setResumeFile(null)
                        setResumeUploaded(false)
                        setResumeId(null)
                        setResumeAnalysis(null)
                      }}
                    >
                      <X size={14} /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="drop-zone-empty">
                    <Upload size={40} className="drop-icon" />
                    <span className="drop-primary">Drop your resume here</span>
                    <span className="drop-secondary">or click to browse · PDF / DOCX · max 10 MB</span>
                  </div>
                )}
              </div>

              {resumeFile && !resumeUploaded && (
                <button
                  className="btn btn-primary"
                  onClick={handleUploadResume}
                  disabled={uploadProgress}
                >
                  {uploadProgress ? <><span className="spinner" /> Uploading...</> : <><Upload size={16} /> Upload Resume</>}
                </button>
              )}

              {resumeUploaded && (
                <div className="success-notice">
                  <CheckCircle size={16} /> Resume uploaded successfully!
                </div>
              )}

              {error && <div className="error-notice"><AlertCircle size={16} /> {error}</div>}

              <div className="ci-actions">
                <div />
                <button
                  className="btn btn-primary"
                  onClick={goNext}
                  disabled={!resumeUploaded}
                >
                  Next: Analyze Resume <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Resume Analysis ──────────────────────────────────────── */}
          {step === 2 && (
            <div className="ci-card glass-card animate-fade-in">
              <h2 className="ci-card-title"><BarChart3 size={20} /> Analyze Resume</h2>
              <p className="ci-card-desc">
                Extract your skills, projects, education, and experience from the uploaded resume.
              </p>

              {analyzeStatus === null && (
                <button className="btn btn-primary" onClick={handleAnalyzeResume}>
                  <BarChart3 size={16} /> Analyze Resume
                </button>
              )}

              {analyzeStatus === 'analyzing' && (
                <div className="loading-state">
                  <Loader2 size={20} className="spin" />
                  <span>Extracting and analyzing resume content...</span>
                </div>
              )}

              {analyzeStatus === 'failed' && (
                <div>
                  {error && <div className="error-notice"><AlertCircle size={16} /> {error}</div>}
                  <button className="btn btn-secondary" onClick={handleAnalyzeResume} style={{ marginTop: 12 }}>
                    Retry Analysis
                  </button>
                </div>
              )}

              {analyzeStatus === 'done' && resumeAnalysis?.parsedData && (
                <div style={{ marginTop: 16 }}>
                  <div className="success-notice" style={{ marginBottom: 16 }}>
                    <CheckCircle size={16} /> Resume analyzed successfully — {resumeAnalysis.parsedData.skills?.length || 0} skills identified
                  </div>
                  <CandidateProfileCard parsedData={resumeAnalysis.parsedData} />
                </div>
              )}

              {error && analyzeStatus !== 'failed' && (
                <div className="error-notice"><AlertCircle size={16} /> {error}</div>
              )}

              <div className="ci-actions" style={{ marginTop: 20 }}>
                <button className="btn btn-ghost" onClick={goBack}>← Back</button>
                <button
                  className="btn btn-primary"
                  onClick={goNext}
                  disabled={analyzeStatus !== 'done'}
                >
                  Next: Job Description <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Job Description ──────────────────────────────────────── */}
          {step === 3 && (
            <div className="ci-card glass-card animate-fade-in">
              <h2 className="ci-card-title"><Briefcase size={20} /> Job Description</h2>
              <p className="ci-card-desc">Paste the job description and specify the target role.</p>

              <div className="form-group">
                <label className="form-label">Target Role *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Full Stack Developer, Data Scientist, ML Engineer"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Job Description *</label>
                <textarea
                  className="form-textarea jd-textarea"
                  placeholder="Paste the full job description here..."
                  value={jdContent}
                  onChange={(e) => setJdContent(e.target.value)}
                  rows={12}
                />
                <span className="char-count">{jdContent.length} characters</span>
              </div>

              {error && <div className="error-notice"><AlertCircle size={16} /> {error}</div>}

              <div className="ci-actions">
                <button className="btn btn-ghost" onClick={goBack}>← Back</button>
                <button className="btn btn-primary" onClick={handleSaveJD} disabled={loading}>
                  {loading ? <><span className="spinner" /> Saving...</> : <>Next: Skill Gap <ChevronRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Skill Gap Analysis ───────────────────────────────────── */}
          {step === 4 && (
            <div className="ci-card glass-card animate-fade-in">
              <h2 className="ci-card-title"><BarChart3 size={20} /> Resume-to-JD Skill Analysis</h2>
              <p className="ci-card-desc">
                Compare your resume against the job description to see your skill coverage.
              </p>

              <div className="dev-notice" style={{ marginBottom: 16 }}>
                ℹ️ Absence from this analysis does not mean you lack a skill — it means it was not identified in the provided resume text.
              </div>

              {!skillGapResult && !skillGapLoading && (
                <button className="btn btn-primary" onClick={handleRunSkillGap}>
                  <BarChart3 size={16} /> Run Skill Gap Analysis
                </button>
              )}

              {skillGapLoading && (
                <div className="loading-state">
                  <Loader2 size={20} className="spin" />
                  <span>{skillGapStatus || 'Running analysis...'}</span>
                </div>
              )}

              {error && !skillGapLoading && (
                <div>
                  <div className="error-notice"><AlertCircle size={16} /> {error}</div>
                  <button className="btn btn-secondary" onClick={handleRunSkillGap} style={{ marginTop: 12 }}>
                    Retry
                  </button>
                </div>
              )}

              {skillGapResult && (
                <div style={{ marginTop: 16 }}>
                  <div className="success-notice" style={{ marginBottom: 20 }}>
                    <CheckCircle size={16} /> Analysis complete — {skillGapResult.skillCoveragePercentage}% skill coverage
                  </div>

                  <SkillCoverageCard
                    coveragePercent={skillGapResult.skillCoveragePercentage}
                    gapPercent={skillGapResult.skillGapPercentage}
                  />

                  <div style={{ marginTop: 20 }}>
                    <SkillGapSummary
                      matchedRequiredSkills={skillGapResult.matchedRequiredSkills}
                      notIdentifiedRequiredSkills={skillGapResult.notIdentifiedRequiredSkills}
                      matchedPreferredSkills={skillGapResult.matchedPreferredSkills}
                      notIdentifiedPreferredSkills={skillGapResult.notIdentifiedPreferredSkills}
                      additionalSkills={skillGapResult.additionalSkills}
                      requiredSkillCount={skillGapResult.requiredSkillCount}
                      matchedRequiredSkillCount={skillGapResult.matchedRequiredSkillCount}
                    />
                  </div>
                </div>
              )}

              <div className="ci-actions" style={{ marginTop: 20 }}>
                <button className="btn btn-ghost" onClick={goBack}>← Back</button>
                <button
                  className="btn btn-primary"
                  onClick={goNext}
                  disabled={!skillGapResult}
                >
                  Next: Settings <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 5: Interview Settings ────────────────────────────────────── */}
          {step === 5 && (
            <div className="ci-card glass-card animate-fade-in">
              <h2 className="ci-card-title"><Settings size={20} /> Interview Settings</h2>
              <p className="ci-card-desc">Customize the type, difficulty, and length of your session.</p>

              <div className="settings-group">
                <label className="form-label">Interview Type</label>
                <div className="option-grid">
                  {INTERVIEW_TYPES.map(({ value, label, desc }) => (
                    <button
                      key={value}
                      className={`option-btn ${interviewType === value ? 'selected' : ''}`}
                      onClick={() => setInterviewType(value)}
                    >
                      <span className="option-label">{label}</span>
                      <span className="option-desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <label className="form-label">Difficulty</label>
                <div className="option-grid option-grid-3">
                  {DIFFICULTIES.map(({ value, label, desc }) => (
                    <button
                      key={value}
                      className={`option-btn ${difficulty === value ? 'selected' : ''}`}
                      onClick={() => setDifficulty(value)}
                    >
                      <span className="option-label">{label}</span>
                      <span className="option-desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <label className="form-label">Interview Duration</label>
                <div className="option-grid option-grid-3">
                  {DURATIONS.map(({ value, label, desc }) => (
                    <button
                      key={value}
                      className={`option-btn ${durationMinutes === value ? 'selected' : ''}`}
                      onClick={() => setDurationMinutes(value)}
                    >
                      <span className="option-label">{label}</span>
                      <span className="option-desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Number of Questions: <strong>{totalQuestions}</strong></label>
                <input
                  type="range"
                  min={5} max={15} step={1}
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(Number(e.target.value))}
                  className="range-slider"
                />
                <div className="range-labels"><span>5</span><span>15</span></div>
              </div>

              <div className="ci-actions">
                <button className="btn btn-ghost" onClick={goBack}>← Back</button>
                <button className="btn btn-primary" onClick={goNext}>
                  Review & Start <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 6: Review ────────────────────────────────────────────────── */}
          {step === 6 && (
            <div className="ci-card glass-card animate-fade-in">
              <h2 className="ci-card-title">Review & Create</h2>
              <p className="ci-card-desc">Confirm your interview settings before starting.</p>

              <div className="review-grid">
                <div className="review-item">
                  <span className="review-label">Resume</span>
                  <span className="review-value">{resumeFile?.name}</span>
                </div>
                <div className="review-item">
                  <span className="review-label">Target Role</span>
                  <span className="review-value">{targetRole}</span>
                </div>
                {skillGapResult && (
                  <div className="review-item">
                    <span className="review-label">Skill Coverage</span>
                    <span className="review-value" style={{ color: '#10b981' }}>
                      {skillGapResult.skillCoveragePercentage}% ({skillGapResult.matchedRequiredSkillCount}/{skillGapResult.requiredSkillCount} required skills)
                    </span>
                  </div>
                )}
                <div className="review-item">
                  <span className="review-label">Interview Type</span>
                  <span className="review-value">{interviewType}</span>
                </div>
                <div className="review-item">
                  <span className="review-label">Difficulty</span>
                  <span className="review-value">{difficulty}</span>
                </div>
                <div className="review-item">
                  <span className="review-label">Duration</span>
                  <span className="review-value">{durationMinutes} minutes</span>
                </div>
                <div className="review-item">
                  <span className="review-label">Questions</span>
                  <span className="review-value">{totalQuestions}</span>
                </div>
              </div>

              <div className="dev-notice" style={{ background: 'rgba(124, 58, 237, 0.1)', borderColor: 'rgba(124, 58, 237, 0.3)', color: '#c4b5fd' }}>
                ✨ <strong>Personalized Interview:</strong> InterviewX will generate targeted questions from your resume projects, experience, and identified skill gaps.
              </div>

              {error && <div className="error-notice"><AlertCircle size={16} /> {error}</div>}

              <div className="ci-actions">
                <button className="btn btn-ghost" onClick={goBack}>← Back</button>
                <button className="btn btn-primary btn-lg" onClick={handleCreateInterview} disabled={loading}>
                  {loading
                    ? <><span className="spinner" /> Creating...</>
                    : <>🚀 Create & Start Interview</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
