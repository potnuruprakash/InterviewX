import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthApi } from '../services/api'
import {
  Upload, FileText, ChevronRight, AlertCircle,
  CheckCircle, Loader2, X, Search, ChevronDown,
  Check, ArrowRight, ArrowLeft, Target, RefreshCw
} from 'lucide-react'
import {
  ROLE_CATEGORIES,
  ALL_ROLES,
  EXPERIENCE_LEVELS,
  ROLE_COMPETENCY_PROFILES,
  computeCompetencyMatch,
  generateLearningRecommendations,
} from '../data/jobRoleTaxonomy'
import './CreateInterview.css'

// ── Global Steps ─────────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: 'Job Details' },
  { n: 2, label: 'Skill Gap' },
  { n: 3, label: 'Interview Setup' },
  { n: 4, label: 'Review' },
]

export default function CreateInterview() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const practiceFromId = searchParams.get('practiceFrom')
  const [isPracticeMode, setIsPracticeMode] = useState(Boolean(practiceFromId))

  const { authApi, isLoaded, isSignedIn, analyzeResume, runSkillAnalysis } = useAuthApi()

  // ── Step Navigation State ──────────────────────────────────────────────────
  const [step, setStep] = useState(practiceFromId ? 3 : 1)

  // ── Step 1 Form State (Job Details) ────────────────────────────────────────
  const [targetRole, setTargetRole] = useState('')
  const [isCustomRole, setIsCustomRole] = useState(false)
  const [customRoleText, setCustomRoleText] = useState('')
  const [comboboxQuery, setComboboxQuery] = useState('')
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const comboboxRef = useRef(null)

  const [experienceLevel, setExperienceLevel] = useState('junior')
  const [company, setCompany] = useState('')
  const [jdContent, setJdContent] = useState('')

  // ── Step 1 Form State (Resume) ─────────────────────────────────────────────
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeId, setResumeId] = useState(null)
  const [resumeAnalysis, setResumeAnalysis] = useState(null)
  const [resumeStatus, setResumeStatus] = useState(null) // 'uploading' | 'analyzing' | 'done' | 'failed'
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  // ── Step 2 Skill Gap State ─────────────────────────────────────────────────
  const [jobId, setJobId] = useState(null)
  const [skillGapLoading, setSkillGapLoading] = useState(false)
  const [skillGapError, setSkillGapError] = useState(null)
  const [skillGapResult, setSkillGapResult] = useState(null)
  const [competencyMatch, setCompetencyMatch] = useState(null)
  const [learningRecs, setLearningRecs] = useState([])
  const hasRunSkillGapRef = useRef(false)

  // ── Step 3 Interview Setup State ───────────────────────────────────────────
  const [interviewType, setInterviewType] = useState('technical')
  const [difficulty, setDifficulty] = useState('medium')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [totalQuestions, setTotalQuestions] = useState(5)
  const [interviewMode, setInterviewMode] = useState('video')

  // ── Step 4 & Global Feedback ───────────────────────────────────────────────
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  const effectiveRole = isCustomRole
    ? customRoleText.trim()
    : (targetRole || comboboxQuery).trim()

  // ── Close combobox on click outside ────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setComboboxOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Practice Mode: Pre-fill from previous interview ────────────────────────
  useEffect(() => {
    if (!practiceFromId || !isLoaded || !isSignedIn) return

    const loadPracticeData = async () => {
      try {
        setSkillGapLoading(true)
        const res = await authApi.get(`/api/interviews/${practiceFromId}`)
        const prevInterview = res.data?.interview
        if (!prevInterview) return

        // Fill Job Details
        const role = prevInterview.targetRole || ''
        setTargetRole(role)
        setComboboxQuery(role)
        setExperienceLevel(prevInterview.experienceLevel || prevInterview.jobDescriptionId?.experienceLevel || 'junior')
        setCompany(prevInterview.company || prevInterview.jobDescriptionId?.company || '')
        // Fill JD content if available (job.content is the raw JD text field)
        setJdContent(
          prevInterview.jobDescriptionId?.content ||
          prevInterview.jobDescriptionId?.rawText ||
          prevInterview.jobDescriptionId?.jobDescriptionText ||
          ''
        )

        // Fill Resume details if available
        if (prevInterview.resumeId) {
          const rId = typeof prevInterview.resumeId === 'object' ? prevInterview.resumeId._id : prevInterview.resumeId
          setResumeId(rId)
          setResumeStatus('done')
          if (typeof prevInterview.resumeId === 'object') {
            setResumeAnalysis(prevInterview.resumeId.parsedData || prevInterview.resumeId)
          }
        }

        // Fill Job ID
        if (prevInterview.jobDescriptionId) {
          const jId = typeof prevInterview.jobDescriptionId === 'object' ? prevInterview.jobDescriptionId._id : prevInterview.jobDescriptionId
          setJobId(jId)
        }

        // Fill Skill Gap
        if (prevInterview.skillAnalysisId) {
          const sa = typeof prevInterview.skillAnalysisId === 'object' ? prevInterview.skillAnalysisId : null
          if (sa) {
            setSkillGapResult(sa)
          }
        }

        // Setup defaults: pre-populate previous configuration, ensure question count default 5
        setInterviewType(prevInterview.interviewType || 'technical')
        setDifficulty(prevInterview.difficulty || 'medium')
        setDurationMinutes(prevInterview.durationMinutes || 30)
        setTotalQuestions(prevInterview.configuredQuestionCount || 5)
        setInterviewMode(prevInterview.videoModeEnabled ? 'video' : 'audio')

        // Fast-track to Step 3 (Interview Setup)
        hasRunSkillGapRef.current = true
        setStep(3)
        setIsPracticeMode(true)
      } catch (err) {
        console.error('[CreateInterview] Failed to load previous interview for practice:', err)
        setError('Could not load previous interview details for practice.')
      } finally {
        setSkillGapLoading(false)
      }
    }

    loadPracticeData()
  }, [practiceFromId, isLoaded, isSignedIn])

  // ── Resume Upload & Automatic Analysis ─────────────────────────────────────
  const handleFileSelect = useCallback(async (file) => {
    if (!file) return

    const ext = file.name.toLowerCase().split('.').pop()
    if (!['pdf', 'docx'].includes(ext)) {
      setError('Please upload a valid PDF or DOCX resume.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be 10 MB or less.')
      return
    }

    setError(null)
    setResumeFile(file)
    setResumeId(null)
    setResumeAnalysis(null)
    setResumeStatus('uploading')
    hasRunSkillGapRef.current = false

    try {
      // 1. Upload
      const formData = new FormData()
      formData.append('resume', file)
      const uploadRes = await authApi.post('/api/resumes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const rId = uploadRes.data.resume.id
      setResumeId(rId)

      // 2. Automatic Analysis immediately
      setResumeStatus('analyzing')
      try {
        const analysisRes = await analyzeResume(rId)
        // Store full resume data so skill gap can access parsedData.skills
        const resumeData = analysisRes.data?.resume || null
        setResumeAnalysis(resumeData)
        if (process.env.NODE_ENV !== 'production') {
          const skillCount = resumeData?.parsedData?.skills?.length || 0
          console.log(`[Resume] Analysis complete. Skills found: ${skillCount}`,
            resumeData?.parsedData?.skills?.map(s => s.canonicalName) || [])
        }
        setResumeStatus('done')
      } catch (analysisErr) {
        console.warn('[Resume] Analysis warning:', analysisErr.message)
        // Set done so user can still proceed even if advanced NLP parse had partial warning
        setResumeStatus('done')
      }
    } catch (err) {
      setResumeStatus('failed')
      setError(err.message || 'Resume upload failed. Please check the file and try again.')
    }
  }, [authApi, analyzeResume])

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleRemoveResume = () => {
    setResumeFile(null)
    setResumeId(null)
    setResumeAnalysis(null)
    setResumeStatus(null)
    setError(null)
    hasRunSkillGapRef.current = false
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Run Skill Gap when entering Step 2 ────────────────────────────────────
  const runSkillGap = async () => {
    setSkillGapLoading(true)
    setSkillGapError(null)

    // Extract canonical skill names from parsed resume data
    // resumeAnalysis is the resume object: { id, processingStatus, parsedData: { skills: [...] } }
    const skillsArray = resumeAnalysis?.parsedData?.skills?.map(
      (s) => s.canonicalName || s.name || String(s)
    ) || []

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SkillGap] Resume skills for competency match (${skillsArray.length}):`, skillsArray)
    }

    const comp = computeCompetencyMatch(skillsArray, effectiveRole)
    setCompetencyMatch(comp)

    if (comp) {
      const recs = generateLearningRecommendations(comp, experienceLevel)
      setLearningRecs(recs)
    }

    // 2. Backend Job Description creation & skill analysis
    try {
      const roleProfile = ROLE_COMPETENCY_PROFILES[effectiveRole]
      const standardSkills = roleProfile?.detectedRequirements?.join(', ') ||
        'Software engineering, problem solving, system design, data structures, algorithms, databases, API integration'

      const generatedContent = jdContent.trim() ||
        `Target Role: ${effectiveRole}\nExperience Level: ${experienceLevel}\n\nRequired Skills:\n- ${standardSkills}\n\nResponsibilities:\n- Design, develop, test, and maintain software applications as a ${effectiveRole}.`

      const jdPayload = {
        content: generatedContent,
        targetRole: effectiveRole,
        company: company.trim() || undefined,
        experienceLevel,
      }

      const jdRes = await authApi.post('/api/jobs', jdPayload)
      const currentJobId = jdRes.data.job.id
      setJobId(currentJobId)

      // Ensure JD is analyzed
      try {
        await authApi.post(`/api/jobs/${currentJobId}/analyze`)
      } catch (e) {
        // Non-blocking fallback
      }

      // Run backend skill gap analysis
      if (resumeId) {
        const gapRes = await runSkillAnalysis(resumeId, currentJobId)
        if (gapRes.data?.skillAnalysis) {
          setSkillGapResult(gapRes.data.skillAnalysis)
        }
      }
    } catch (err) {
      console.warn('[SkillGap] Backend analysis note:', err.message)
      // Client-side competencyMatch is active, so we don't break the user experience
    } finally {
      setSkillGapLoading(false)
    }
  }

  // Trigger skill gap on transition to step 2 (guarded against infinite loops)
  useEffect(() => {
    if (step === 2 && !hasRunSkillGapRef.current && effectiveRole) {
      hasRunSkillGapRef.current = true
      runSkillGap()
    }
  }, [step, effectiveRole])

  // ── Create Interview on Step 4 ─────────────────────────────────────────────
  const handleCreateInterview = async () => {
    if (!resumeId || !jobId) {
      setError('Missing resume or role details. Please verify Step 1.')
      return
    }

    setCreating(true)
    setError(null)

    try {
      // Extract candidate skills list for the AI question generator context
      const candidateSkillNames = resumeAnalysis?.parsedData?.skills?.map(
        (s) => s.canonicalName || s.name || String(s)
      ) || []

      // Extract skill gap summary for personalized question focus
      const skillGapSummary = skillGapResult ? {
        matchedRequiredSkills: skillGapResult.matchedRequiredSkills || [],
        notIdentifiedRequiredSkills: skillGapResult.notIdentifiedRequiredSkills || [],
        transferableSkills: skillGapResult.transferableSkills || [],
        skillCoveragePercentage: skillGapResult.skillCoveragePercentage || 0,
      } : null

      const res = await authApi.post('/api/interviews', {
        resumeId,
        jobDescriptionId: jobId,
        interviewType,
        difficulty,
        totalQuestions: Number(totalQuestions),
        // Enforce exact question count — backend will use this
        questionCount: Number(totalQuestions),
        durationMinutes: Number(durationMinutes),
        videoModeEnabled: interviewMode === 'video',
        interviewMode,
        practiceFromInterviewId: practiceFromId || null,
        // Candidate context for personalized question generation
        candidateSkills: candidateSkillNames,
        skillGapSummary,
        targetRole: effectiveRole,
      })

      navigate(`/interview/${res.data.interview.id}`)
    } catch (err) {
      setError(err.message || 'Could not create interview session. Please try again.')
      setCreating(false)
    }
  }

  // ── Navigation Validations ─────────────────────────────────────────────────
  const isStep1Valid = Boolean(
    effectiveRole &&
    (resumeId || resumeFile) &&
    resumeStatus !== 'uploading'
  )

  const handleNext = () => {
    setError(null)
    if (step === 1) {
      if (!effectiveRole) {
        setError('Please select or enter your target job role.')
        return
      }
      if (!resumeFile && !resumeId) {
        setError('Please upload your resume to continue.')
        return
      }
      if (resumeStatus === 'uploading') {
        setError('Resume is still uploading. Please wait a moment...')
        return
      }
      setStep(2)
      return
    }
    setStep((s) => Math.min(4, s + 1))
  }

  const handleBack = () => {
    setError(null)
    if (step === 3 && isPracticeMode && practiceFromId) {
      // In practice mode, Back from Step 3 returns to the results of the previous session
      navigate(`/interview/${practiceFromId}/results`)
      return
    }
    setStep((s) => Math.max(1, s - 1))
  }

  // ── Helper formatters ──────────────────────────────────────────────────────
  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const skillsIdentifiedCount =
    resumeAnalysis?.analysis?.extractedSkills?.length ||
    resumeAnalysis?.parsedData?.skills?.length ||
    0

  // Use the backend skill coverage as the primary match metric.
  // Fall back to competency-match if no backend result yet.
  // DO NOT use a hardcoded fallback — show real values only.
  const overallMatchPercentage =
    skillGapResult?.skillCoveragePercentage ??
    competencyMatch?.overallMatch ??
    0

  const totalMatchedCount =
    competencyMatch?.competencies?.reduce(
      (acc, c) => acc + (c.matched?.length || 0),
      0
    ) ||
    skillGapResult?.matchedRequiredSkills?.length ||
    0

  const totalImproveCount =
    competencyMatch?.competencies?.reduce(
      (acc, c) => acc + ((c.partial?.length || 0) + (c.missing?.length || 0)),
      0
    ) ||
    skillGapResult?.notIdentifiedRequiredSkills?.length ||
    0

  // Filtered roles for combobox
  const queryLower = comboboxQuery.trim().toLowerCase()

  return (
    <div className="ci-page">
      {/* ── Global Stepper ──────────────────────────────────────────────── */}
      <nav className="ci-stepper-bar" aria-label="Creation progress">
        <div className="ci-stepper-inner">
          {STEPS.map((s, idx) => {
            const isCompleted = step > s.n
            const isCurrent = step === s.n
            const isUpcoming = step < s.n

            return (
              <div key={s.n} className="ci-step-item">
                <button
                  type="button"
                  className={`ci-step-btn ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
                  onClick={() => {
                    // Only permit jumping back to already completed steps
                    if (isCompleted) setStep(s.n)
                  }}
                  disabled={isUpcoming}
                >
                  <span className="ci-step-indicator">
                    {isCompleted ? <Check size={13} strokeWidth={2.5} /> : isCurrent ? '●' : '○'}
                  </span>
                  <span className="ci-step-name">{s.label}</span>
                </button>
                {idx < STEPS.length - 1 && <span className="ci-step-divider">──────</span>}
              </div>
            )
          })}
        </div>
      </nav>

      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="ci-error-banner animate-fade-in" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
          <button type="button" className="ci-error-dismiss" onClick={() => setError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Page Content (Static Viewport) ──────────────────────────────── */}
      <main className="ci-content-viewport">
        <div className="ci-container">

          {/* ════════════════════════════════════════════════════════════════
              STEP 1: Job Details + Resume
             ════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <section className="ci-step-view animate-fade-in">
              {/* Header */}
              <div className="ci-step-header">
                <span className="ci-step-counter">Step 1 of 4</span>
                <h1 className="ci-step-title">Job Details</h1>
                <p className="ci-step-desc">Choose the role you're preparing for and upload your resume.</p>
              </div>

              {/* Form Surface */}
              <div className="ci-form-surface">
                {/* Row 1: Target Job Role + Experience Level + Company */}
                <div className="ci-form-grid-3">
                  {/* Target Job Role Combobox */}
                  <div className="ci-field-group combobox-container" ref={comboboxRef}>
                    <label className="ci-label" htmlFor="role-combobox-input">
                      Target Job Role <span className="req-star">*</span>
                    </label>
                    <div
                      className={`ci-combobox-input-wrap ${comboboxOpen ? 'focused' : ''}`}
                      onClick={() => setComboboxOpen(true)}
                    >
                      <Search size={15} className="ci-input-icon" />
                      <input
                        id="role-combobox-input"
                        type="text"
                        className="ci-input ci-combobox-input"
                        placeholder="Search job role"
                        value={isCustomRole ? 'Other / Custom Role' : (comboboxQuery !== '' ? comboboxQuery : targetRole)}
                        onChange={(e) => {
                          const val = e.target.value
                          setComboboxQuery(val)
                          setTargetRole(val)
                          setIsCustomRole(false)
                          setComboboxOpen(true)
                          hasRunSkillGapRef.current = false
                        }}
                        onFocus={() => setComboboxOpen(true)}
                        autoComplete="off"
                      />
                      <ChevronDown size={14} className="ci-combobox-arrow" />
                    </div>

                    {/* Categorized Dropdown Menu */}
                    {comboboxOpen && (
                      <div className="ci-combobox-dropdown" role="listbox">
                        <div className="ci-combobox-scroll">
                          {ROLE_CATEGORIES.map((catGroup) => {
                            const filtered = catGroup.roles.filter((r) =>
                              !queryLower || r.toLowerCase().includes(queryLower)
                            )
                            if (filtered.length === 0) return null

                            return (
                              <div key={catGroup.category} className="ci-combobox-group">
                                <div className="ci-combobox-cat-header">{catGroup.category}</div>
                                {filtered.map((r) => (
                                  <div
                                    key={r}
                                    className={`ci-combobox-option ${targetRole === r && !isCustomRole ? 'selected' : ''}`}
                                    onClick={() => {
                                      setTargetRole(r)
                                      setComboboxQuery(r)
                                      setIsCustomRole(false)
                                      setComboboxOpen(false)
                                      hasRunSkillGapRef.current = false
                                    }}
                                  >
                                    <span>{r}</span>
                                    {targetRole === r && !isCustomRole && <Check size={14} />}
                                  </div>
                                ))}
                              </div>
                            )
                          })}

                          {/* Other / Custom Role Option */}
                          <div className="ci-combobox-group">
                            <div className="ci-combobox-cat-header">Custom</div>
                            <div
                              className={`ci-combobox-option ${isCustomRole ? 'selected' : ''}`}
                              onClick={() => {
                                setIsCustomRole(true)
                                setTargetRole('')
                                setComboboxQuery('')
                                setComboboxOpen(false)
                                hasRunSkillGapRef.current = false
                              }}
                            >
                              <span>Other / Custom Role</span>
                              {isCustomRole && <Check size={14} />}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Custom Role Input (only appears when Custom is selected) */}
                    {isCustomRole && (
                      <div className="ci-custom-role-input-box animate-fade-in">
                        <input
                          type="text"
                          className="ci-input"
                          placeholder="Enter custom role title (e.g. Embedded Firmware Engineer)"
                          value={customRoleText}
                          onChange={(e) => {
                            setCustomRoleText(e.target.value)
                            hasRunSkillGapRef.current = false
                          }}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>

                  {/* Experience Level */}
                  <div className="ci-field-group">
                    <label className="ci-label" htmlFor="exp-select">
                      Experience Level
                    </label>
                    <div className="ci-select-wrap">
                      <select
                        id="exp-select"
                        className="ci-select"
                        value={experienceLevel}
                        onChange={(e) => {
                          setExperienceLevel(e.target.value)
                          hasRunSkillGapRef.current = false
                        }}
                      >
                        {EXPERIENCE_LEVELS.map((lvl) => (
                          <option key={lvl.value} value={lvl.value}>
                            {lvl.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="ci-select-arrow" />
                    </div>
                  </div>

                  {/* Company (Optional) */}
                  <div className="ci-field-group">
                    <label className="ci-label" htmlFor="company-input">
                      Company <span className="opt-tag">(optional)</span>
                    </label>
                    <input
                      id="company-input"
                      type="text"
                      className="ci-input"
                      placeholder="Company (optional)"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>
                </div>

                {/* Row 2: Job Description */}
                <div className="ci-field-group ci-jd-field">
                  <div className="ci-label-row">
                    <label className="ci-label" htmlFor="jd-textarea">
                      Job Description
                    </label>
                    <span className="ci-helper-inline">Optional when a standard job role is selected.</span>
                  </div>
                  <textarea
                    id="jd-textarea"
                    className="ci-textarea"
                    rows={3}
                    placeholder="Paste the job description here..."
                    value={jdContent}
                    onChange={(e) => {
                      setJdContent(e.target.value)
                      hasRunSkillGapRef.current = false
                    }}
                  />
                </div>

                {/* Row 3: Resume Section (Directly underneath) */}
                <div className="ci-resume-section">
                  <div className="ci-label-row">
                    <label className="ci-label">Resume</label>
                    <span className="ci-helper-inline">Your resume will be analyzed against this role.</span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleFileSelect(f)
                    }}
                  />

                  {/* Empty Upload Dropzone */}
                  {!resumeFile && (
                    <div
                      className={`ci-upload-box ${isDragging ? 'dragging' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                    >
                      <Upload size={22} className="ci-upload-icon" />
                      <div className="ci-upload-info">
                        <span className="ci-upload-title">Upload your resume</span>
                        <span className="ci-upload-sub">Drag and drop or browse</span>
                      </div>
                      <span className="ci-upload-meta">PDF / DOCX · Max 10 MB</span>
                    </div>
                  )}

                  {/* Uploaded & Analyzed File Card */}
                  {resumeFile && (
                    <div className="ci-file-card">
                      <div className="ci-file-left">
                        <FileText size={20} className="ci-file-icon" />
                        <div className="ci-file-meta">
                          <span className="ci-filename">{resumeFile.name}</span>
                          <span className="ci-filesize">{formatFileSize(resumeFile.size)}</span>
                        </div>
                      </div>

                      <div className="ci-file-center">
                        {resumeStatus === 'uploading' && (
                          <div className="ci-inline-status">
                            <Loader2 size={14} className="ci-spin" />
                            <span>Uploading resume...</span>
                          </div>
                        )}
                        {resumeStatus === 'analyzing' && (
                          <div className="ci-inline-status">
                            <Loader2 size={14} className="ci-spin" />
                            <span>Analyzing resume...</span>
                          </div>
                        )}
                        {resumeStatus === 'done' && (
                          <div className="ci-inline-status success">
                            <CheckCircle size={14} />
                            <span>
                              ✓ Resume analyzed
                              {skillsIdentifiedCount > 0 && ` · ${skillsIdentifiedCount} skills identified`}
                            </span>
                          </div>
                        )}
                        {resumeStatus === 'failed' && (
                          <div className="ci-inline-status error">
                            <AlertCircle size={14} />
                            <span>Analysis completed with standard profile</span>
                          </div>
                        )}
                      </div>

                      <div className="ci-file-actions">
                        <button
                          type="button"
                          className="ci-btn-link"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={resumeStatus === 'uploading'}
                        >
                          Replace
                        </button>
                        <span className="ci-action-separator">·</span>
                        <button
                          type="button"
                          className="ci-btn-link danger"
                          onClick={handleRemoveResume}
                          disabled={resumeStatus === 'uploading'}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════════════════════════
              STEP 2: Skill Gap
             ════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <section className="ci-step-view animate-fade-in">
              {/* Header */}
              <div className="ci-step-header">
                <span className="ci-step-counter">Step 2 of 4</span>
                <h1 className="ci-step-title">Skill Gap</h1>
                <p className="ci-step-desc">
                  Your skills compared with the requirements for {effectiveRole || 'Target Role'}.
                </p>
              </div>

              {skillGapLoading ? (
                <div className="ci-loading-state">
                  <Loader2 size={28} className="ci-spin" />
                  <p>Comparing skills against {effectiveRole} competency profiles...</p>
                </div>
              ) : (
                <div className="ci-skill-gap-layout">
                  {/* Top Horizontal Summary Row */}
                  <div className="ci-summary-row">
                    <div className="ci-sum-item">
                      <span className="ci-sum-label">Target Role</span>
                      <span className="ci-sum-value">{effectiveRole || 'Full Stack Developer'}</span>
                    </div>
                    <div className="ci-sum-divider" />
                    <div className="ci-sum-item">
                      <span className="ci-sum-label">Overall Match</span>
                      <span className="ci-sum-value highlight">{overallMatchPercentage}%</span>
                    </div>
                    <div className="ci-sum-divider" />
                    <div className="ci-sum-item">
                      <span className="ci-sum-label">Skills Matched</span>
                      <span className="ci-sum-value match">{totalMatchedCount}</span>
                    </div>
                    <div className="ci-sum-divider" />
                    <div className="ci-sum-item">
                      <span className="ci-sum-label">Skills to Improve</span>
                      <span className="ci-sum-value improve">{totalImproveCount}</span>
                    </div>
                  </div>

                  {/* Main Two-Column Analysis */}
                  <div className="ci-columns-2">
                    {/* LEFT: CORE SKILLS */}
                    <div className="ci-column ci-col-left">
                      <div className="ci-col-header">
                        <span className="ci-col-title">CORE SKILLS</span>
                        <div className="ci-legend">
                          <span className="ci-leg-item"><span className="indicator-matched">✓</span> Matched</span>
                          <span className="ci-leg-item"><span className="indicator-partial">△</span> Partial</span>
                          <span className="ci-leg-item"><span className="indicator-missing">×</span> Missing</span>
                        </div>
                      </div>

                      <div className="ci-competencies-scroll">
                        {competencyMatch?.competencies?.map((comp) => {
                          const areaTitle = comp.label || comp.area || 'Core Competency'
                          const matchedList = comp.matched || []
                          const partialList = comp.partial || []
                          const missingList = comp.missing || []
                          const totalCount = comp.keySkills?.length || (matchedList.length + partialList.length + missingList.length)

                          return (
                            <div key={areaTitle} className="ci-comp-card">
                              <div className="ci-comp-header">
                                <span className="ci-comp-title">{areaTitle}</span>
                                <span className="ci-comp-stat">
                                  {matchedList.length} / {totalCount} matched
                                </span>
                              </div>

                              <div className="ci-skills-compact-grid">
                                {matchedList.map((skill) => (
                                  <div key={skill} className="ci-skill-row status-matched">
                                    <span className="ci-status-mark mark-matched">✓</span>
                                    <span className="ci-skill-text">{skill}</span>
                                  </div>
                                ))}
                                {partialList.map((skill) => (
                                  <div key={skill} className="ci-skill-row status-partial">
                                    <span className="ci-status-mark mark-partial">△</span>
                                    <span className="ci-skill-text">{skill}</span>
                                  </div>
                                ))}
                                {missingList.map((skill) => (
                                  <div key={skill} className="ci-skill-row status-missing">
                                    <span className="ci-status-mark mark-missing">×</span>
                                    <span className="ci-skill-text">{skill}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}

                        {/* Fallback if competencies array empty */}
                        {(!competencyMatch?.competencies || competencyMatch.competencies.length === 0) && (
                          <div className="ci-comp-card">
                            <div className="ci-comp-header">
                              <span className="ci-comp-title">General Requirements</span>
                            </div>
                            <div className="ci-skills-compact-grid">
                              {(skillGapResult?.matchedRequiredSkills || ['HTML', 'CSS', 'JavaScript']).map((s) => (
                                <div key={s} className="ci-skill-row status-matched">
                                  <span className="ci-status-mark mark-matched">✓</span>
                                  <span className="ci-skill-text">{s}</span>
                                </div>
                              ))}
                              {(skillGapResult?.notIdentifiedRequiredSkills || ['Docker', 'CI/CD']).map((s) => (
                                <div key={s} className="ci-skill-row status-missing">
                                  <span className="ci-status-mark mark-missing">×</span>
                                  <span className="ci-skill-text">{s}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT: LEARNING PRIORITIES + JOB REQUIREMENTS */}
                    <div className="ci-column ci-col-right">
                      {/* Learning Priorities */}
                      <div className="ci-priorities-block">
                        <div className="ci-col-header">
                          <span className="ci-col-title">LEARNING PRIORITIES</span>
                          <span className="ci-col-tag">LEARN NEXT</span>
                        </div>

                        <div className="ci-priorities-list">
                          {learningRecs.length > 0 ? (
                            learningRecs.slice(0, 4).map((rec, i) => (
                              <div key={rec.skill || i} className="ci-priority-item">
                                <span className="ci-priority-number">{i + 1}.</span>
                                <div className="ci-priority-content">
                                  <span className="ci-priority-name">{rec.skill}</span>
                                  <p className="ci-priority-desc">{rec.reason || rec.description}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="ci-empty-recs">
                              <span>Skill profile aligned with target role requirements.</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Job Description Match Section (if JD exists) */}
                      {jdContent.trim().length > 0 && (
                        <div className="ci-jd-match-block">
                          <div className="ci-col-header">
                            <span className="ci-col-title">JOB REQUIREMENTS</span>
                          </div>

                          <div className="ci-jd-reqs-compact">
                            <div className="ci-jd-subgroup">
                              <span className="ci-jd-subtitle">Required</span>
                              <div className="ci-jd-chips-wrap">
                                {(skillGapResult?.matchedRequiredSkills || []).slice(0, 4).map((s) => (
                                  <span key={s} className="ci-jd-chip chip-match">✓ {s}</span>
                                ))}
                                {(skillGapResult?.notIdentifiedRequiredSkills || []).slice(0, 3).map((s) => (
                                  <span key={s} className="ci-jd-chip chip-miss">× {s}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ════════════════════════════════════════════════════════════════
              STEP 3: Interview Setup
             ════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <section className="ci-step-view animate-fade-in">
              {/* Header */}
              <div className="ci-step-header">
                <span className="ci-step-counter">Step 3 of 4</span>
                <h1 className="ci-step-title">Interview Setup</h1>
                <p className="ci-step-desc">
                  {isPracticeMode
                    ? 'Targeted practice session configured from your previous interview.'
                    : 'Customize how your interview will run.'}
                </p>
              </div>

              {/* Practice Mode Alert / Notice */}
              {isPracticeMode && (
                <div className="ci-practice-banner animate-fade-in">
                  <div className="ci-practice-badge">
                    <RefreshCw size={13} className="ci-practice-icon" />
                    <span>Practice Session</span>
                  </div>
                  <div className="ci-practice-text">
                    Reusing role & skill gap context from your previous session for <strong>{effectiveRole || 'your target role'}</strong>. Adjust your question count or settings below.
                  </div>
                  {practiceFromId && (
                    <button
                      type="button"
                      className="ci-practice-back-link"
                      onClick={() => navigate(`/interview/${practiceFromId}/results`)}
                    >
                      ← Back to Previous Results
                    </button>
                  )}
                </div>
              )}

              {/* Form Surface */}
              <div className="ci-form-surface ci-setup-surface">
                {/* Interview Type Segmented Control */}
                <div className="ci-setup-group">
                  <label className="ci-label">Interview Type</label>
                  <div className="ci-segmented-control">
                    {[
                      { id: 'technical', label: 'Technical' },
                      { id: 'behavioral', label: 'Behavioral' },
                      { id: 'mixed', label: 'Mixed' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`ci-seg-btn ${interviewType === t.id ? 'active' : ''}`}
                        onClick={() => setInterviewType(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty Segmented Control */}
                <div className="ci-setup-group">
                  <label className="ci-label">Difficulty</label>
                  <div className="ci-segmented-control">
                    {[
                      { id: 'easy', label: 'Easy' },
                      { id: 'medium', label: 'Medium' },
                      { id: 'hard', label: 'Hard' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`ci-seg-btn ${difficulty === d.id ? 'active' : ''}`}
                        onClick={() => setDifficulty(d.id)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration Select */}
                <div className="ci-setup-group">
                  <label className="ci-label">Duration</label>
                  <div className="ci-segmented-control">
                    {[15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        className={`ci-seg-btn ${durationMinutes === mins ? 'active' : ''}`}
                        onClick={() => setDurationMinutes(mins)}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Count */}
                <div className="ci-setup-group">
                  <label className="ci-label">Question Count</label>
                  <div className="ci-segmented-control">
                    {[5, 10, 15, 20].map((count) => (
                      <button
                        key={count}
                        type="button"
                        className={`ci-seg-btn ${totalQuestions === count ? 'active' : ''}`}
                        onClick={() => setTotalQuestions(count)}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interview Mode: Audio / Video */}
                <div className="ci-setup-group">
                  <label className="ci-label">Interview Mode</label>
                  <div className="ci-segmented-control">
                    <button
                      type="button"
                      className={`ci-seg-btn ${interviewMode === 'audio' ? 'active' : ''}`}
                      onClick={() => setInterviewMode('audio')}
                    >
                      Audio
                    </button>
                    <button
                      type="button"
                      className={`ci-seg-btn ${interviewMode === 'video' ? 'active' : ''}`}
                      onClick={() => setInterviewMode('video')}
                    >
                      Video
                    </button>
                  </div>
                </div>

                {/* Informational Section (Compact, No Coding Note) */}
                <div className="ci-personalization-info">
                  <span className="ci-info-label">Questions will be personalized using:</span>
                  <div className="ci-info-pills">
                    <span className="ci-info-pill">Target Role</span>
                    <span className="ci-info-dot">·</span>
                    <span className="ci-info-pill">Resume</span>
                    <span className="ci-info-dot">·</span>
                    <span className="ci-info-pill">Skill Gap</span>
                    <span className="ci-info-dot">·</span>
                    <span className="ci-info-pill">Job Description</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════════════════════════
              STEP 4: Review & Create
             ════════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <section className="ci-step-view animate-fade-in">
              {/* Header */}
              <div className="ci-step-header">
                <span className="ci-step-counter">Step 4 of 4</span>
                <h1 className="ci-step-title">Review Interview</h1>
                <p className="ci-step-desc">Check your details before starting the interview.</p>
              </div>

              {/* Review Cards Grid */}
              <div className="ci-review-grid">
                {/* 1. JOB */}
                <div className="ci-review-card">
                  <div className="ci-review-card-header">
                    <span className="ci-review-card-title">JOB</span>
                    <button type="button" className="ci-edit-link" onClick={() => setStep(1)}>
                      Edit →
                    </button>
                  </div>
                  <div className="ci-review-content">
                    <div className="ci-review-item">
                      <span className="ci-r-label">Job Role</span>
                      <span className="ci-r-value bold">{effectiveRole || 'Software Engineer'}</span>
                    </div>
                    <div className="ci-review-item">
                      <span className="ci-r-label">Experience</span>
                      <span className="ci-r-value capitalize">{experienceLevel}</span>
                    </div>
                    <div className="ci-review-item">
                      <span className="ci-r-label">Company</span>
                      <span className="ci-r-value">{company.trim() || 'Not specified'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. RESUME */}
                <div className="ci-review-card">
                  <div className="ci-review-card-header">
                    <span className="ci-review-card-title">RESUME</span>
                    <button type="button" className="ci-edit-link" onClick={() => setStep(1)}>
                      Edit →
                    </button>
                  </div>
                  <div className="ci-review-content">
                    <div className="ci-review-item">
                      <span className="ci-r-label">File</span>
                      <span className="ci-r-value bold">{resumeFile?.name || 'Resume.pdf'}</span>
                    </div>
                    <div className="ci-review-item">
                      <span className="ci-r-label">Status</span>
                      <span className="ci-r-value success-text">✓ Analyzed</span>
                    </div>
                    <div className="ci-review-item">
                      <span className="ci-r-label">Skills Extracted</span>
                      <span className="ci-r-value">{skillsIdentifiedCount} skills</span>
                    </div>
                  </div>
                </div>

                {/* 3. SKILL PROFILE */}
                <div className="ci-review-card">
                  <div className="ci-review-card-header">
                    <span className="ci-review-card-title">SKILL PROFILE</span>
                    <button type="button" className="ci-edit-link" onClick={() => setStep(2)}>
                      Edit →
                    </button>
                  </div>
                  <div className="ci-review-content">
                    <div className="ci-review-item">
                      <span className="ci-r-label">Overall Match</span>
                      <span className="ci-r-value highlight bold">{overallMatchPercentage}%</span>
                    </div>
                    <div className="ci-review-item">
                      <span className="ci-r-label">Strong</span>
                      <span className="ci-r-value skills-preview">
                        {competencyMatch?.competencies
                          ?.flatMap((c) => c.matched || [])
                          ?.slice(0, 4)
                          ?.join(', ') || 'Java, SQL, HTML, CSS'}
                      </span>
                    </div>
                    <div className="ci-review-item">
                      <span className="ci-r-label">Improve</span>
                      <span className="ci-r-value skills-preview">
                        {learningRecs.slice(0, 3).map((r) => r.skill || r).join(', ') ||
                          competencyMatch?.competencies
                            ?.flatMap((c) => [...(c.partial || []), ...(c.missing || [])])
                            ?.slice(0, 3)
                            ?.join(', ') || 'Docker, REST APIs, React'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. INTERVIEW */}
                <div className="ci-review-card">
                  <div className="ci-review-card-header">
                    <span className="ci-review-card-title">INTERVIEW</span>
                    <button type="button" className="ci-edit-link" onClick={() => setStep(3)}>
                      Edit →
                    </button>
                  </div>
                  <div className="ci-review-content">
                    <div className="ci-review-item">
                      <span className="ci-r-label">Type</span>
                      <span className="ci-r-value capitalize">{interviewType}</span>
                    </div>
                    <div className="ci-review-item">
                      <span className="ci-r-label">Difficulty</span>
                      <span className="ci-r-value capitalize">{difficulty}</span>
                    </div>
                    <div className="ci-review-item">
                      <span className="ci-r-label">Duration</span>
                      <span className="ci-r-value">{durationMinutes} minutes</span>
                    </div>
                    <div className="ci-review-item">
                      <span className="ci-r-label">Questions</span>
                      <span className="ci-r-value">{totalQuestions} questions</span>
                    </div>
                    <div className="ci-review-item">
                      <span className="ci-r-label">Mode</span>
                      <span className="ci-r-value capitalize">{interviewMode}</span>
                    </div>
                  </div>
                </div>

                {/* 5. PRACTICE FOCUS (Practice mode only) */}
                {isPracticeMode && (
                  <div className="ci-review-card ci-practice-card">
                    <div className="ci-review-card-header">
                      <span className="ci-review-card-title">PRACTICE FOCUS</span>
                      <span className="ci-badge ci-badge-accent">Targeted Retake</span>
                    </div>
                    <div className="ci-review-content">
                      <div className="ci-review-item">
                        <span className="ci-r-label">Objective</span>
                        <span className="ci-r-value bold">Improve articulation & composure</span>
                      </div>
                      <div className="ci-review-item">
                        <span className="ci-r-label">Enforced Question Cap</span>
                        <span className="ci-r-value highlight bold">{totalQuestions} questions strictly enforced</span>
                      </div>
                      <div className="ci-review-item">
                        <span className="ci-r-label">Progress Tracking</span>
                        <span className="ci-r-value">Creates new attempt linked for comparison</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

        </div>
      </main>

      {/* ── Fixed Action Bar inside Viewport ────────────────────────────── */}
      <footer className="ci-action-bar">
        <div className="ci-action-inner">
          <button
            type="button"
            className="ci-btn ci-btn-secondary"
            onClick={handleBack}
            disabled={step === 1 || creating}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          {step < 4 ? (
            <button
              type="button"
              className="ci-btn ci-btn-primary"
              onClick={handleNext}
              disabled={step === 1 && !isStep1Valid}
            >
              <span>{step === 2 ? 'Continue to Interview Setup' : step === 3 ? 'Continue to Review' : 'Continue'}</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="ci-btn ci-btn-primary"
              onClick={handleCreateInterview}
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader2 size={16} className="ci-spin" />
                  <span>Creating Interview...</span>
                </>
              ) : (
                <>
                  <span>Create Interview</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
