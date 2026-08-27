import './phase2.css'

/**
 * SkillBadge — single skill chip with variant styling.
 * variant: 'matched' | 'missing' | 'preferred' | 'additional' | 'neutral'
 */
export const SkillBadge = ({ name, variant = 'neutral' }) => (
  <span className={`skill-badge skill-badge-${variant}`}>
    {name}
  </span>
)

/**
 * SkillCoverageCard — shows coverage + gap rings side by side.
 * Props: coveragePercent, gapPercent
 */
export const SkillCoverageCard = ({ coveragePercent = 0, gapPercent = 100 }) => {
  const R = 52
  const circumference = 2 * Math.PI * R

  const coverageOffset = circumference - (coveragePercent / 100) * circumference
  const gapOffset = circumference - (gapPercent / 100) * circumference

  return (
    <div className="coverage-card">
      <div className="coverage-rings">
        {/* Coverage Ring */}
        <div className="coverage-ring-wrap">
          <div className="coverage-ring">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle className="ring-track" cx="60" cy="60" r={R} />
              <circle
                className="ring-fill-green"
                cx="60" cy="60" r={R}
                strokeDasharray={circumference}
                strokeDashoffset={coverageOffset}
              />
            </svg>
            <div className="ring-center-text">
              <span className="ring-percent ring-percent-green">{coveragePercent}%</span>
            </div>
          </div>
          <span className="ring-sublabel">Skill Coverage</span>
          <span className="ring-label">Required skills identified in resume</span>
        </div>

        {/* Gap Ring */}
        <div className="coverage-ring-wrap">
          <div className="coverage-ring">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle className="ring-track" cx="60" cy="60" r={R} />
              <circle
                className="ring-fill-red"
                cx="60" cy="60" r={R}
                strokeDasharray={circumference}
                strokeDashoffset={gapOffset}
              />
            </svg>
            <div className="ring-center-text">
              <span className="ring-percent ring-percent-red">{gapPercent}%</span>
            </div>
          </div>
          <span className="ring-sublabel">Skill Gap</span>
          <span className="ring-label">Required skills not found in resume</span>
        </div>
      </div>
    </div>
  )
}

/**
 * SkillGapSummary — shows all four skill lists (matched/missing required + preferred + additional).
 */
export const SkillGapSummary = ({
  matchedRequiredSkills = [],
  notIdentifiedRequiredSkills = [],
  matchedPreferredSkills = [],
  notIdentifiedPreferredSkills = [],
  additionalSkills = [],
  requiredSkillCount = 0,
  matchedRequiredSkillCount = 0,
}) => (
  <div className="gap-summary">
    {/* Matched Required */}
    <div className="gap-section">
      <div className="gap-section-title">
        ✅ Matched Required Skills ({matchedRequiredSkillCount} / {requiredSkillCount})
      </div>
      <div className="gap-badges">
        {matchedRequiredSkills.length > 0
          ? matchedRequiredSkills.map((s) => <SkillBadge key={s} name={s} variant="matched" />)
          : <span className="gap-empty">None matched</span>
        }
      </div>
    </div>

    {/* Not Identified Required */}
    <div className="gap-section">
      <div className="gap-section-title">
        ⚠️ Not Identified in Resume — Required
      </div>
      <div className="gap-badges">
        {notIdentifiedRequiredSkills.length > 0
          ? notIdentifiedRequiredSkills.map((s) => <SkillBadge key={s} name={s} variant="missing" />)
          : <span className="gap-empty">All required skills are identified ✓</span>
        }
      </div>
    </div>

    {/* Preferred — Matched */}
    {(matchedPreferredSkills.length > 0 || notIdentifiedPreferredSkills.length > 0) && (
      <div className="gap-section">
        <div className="gap-section-title">🔵 Preferred Skills — Matched</div>
        <div className="gap-badges">
          {matchedPreferredSkills.length > 0
            ? matchedPreferredSkills.map((s) => <SkillBadge key={s} name={s} variant="preferred" />)
            : <span className="gap-empty">None matched</span>
          }
        </div>
      </div>
    )}

    {/* Preferred — Not Identified */}
    {notIdentifiedPreferredSkills.length > 0 && (
      <div className="gap-section">
        <div className="gap-section-title">ℹ️ Not Identified in Resume — Preferred</div>
        <div className="gap-badges">
          {notIdentifiedPreferredSkills.map((s) => <SkillBadge key={s} name={s} variant="neutral" />)}
        </div>
      </div>
    )}

    {/* Additional */}
    {additionalSkills.length > 0 && (
      <div className="gap-section">
        <div className="gap-section-title">➕ Additional Candidate Skills</div>
        <div className="gap-badges">
          {additionalSkills.map((s) => <SkillBadge key={s} name={s} variant="additional" />)}
        </div>
      </div>
    )}
  </div>
)

/**
 * CandidateProfileCard — displays extracted candidate profile data.
 */
export const CandidateProfileCard = ({ parsedData }) => {
  if (!parsedData) return <div className="profile-no-data">No profile data available.</div>

  const { basicInfo, skills = [], projects = [], experience = [], education = [], certifications = [] } = parsedData

  // Group skills by category
  const byCategory = {}
  for (const skill of skills) {
    const cat = skill.category || 'other'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(skill)
  }

  const categoryLabels = {
    programming_language: 'Languages',
    framework: 'Frameworks',
    runtime: 'Runtimes',
    database: 'Databases',
    cloud: 'Cloud',
    devops: 'DevOps',
    ml_framework: 'ML Frameworks',
    ml_library: 'ML Libraries',
    data_library: 'Data Libraries',
    tool: 'Tools',
    testing: 'Testing',
    web: 'Web Technologies',
    concept: 'Concepts',
    library: 'Libraries',
    methodology: 'Methodologies',
    os: 'Operating Systems',
    messaging: 'Messaging',
    infrastructure: 'Infrastructure',
    other: 'Other',
  }

  return (
    <div className="profile-card">
      {/* Basic Info */}
      {basicInfo && (basicInfo.name || basicInfo.email || basicInfo.phone || basicInfo.location) && (
        <div className="profile-section">
          <div className="profile-section-title">👤 Basic Information</div>
          <div className="profile-basic-info">
            {basicInfo.name && <div className="profile-info-item"><span className="profile-info-label">Name</span><span className="profile-info-value">{basicInfo.name}</span></div>}
            {basicInfo.email && <div className="profile-info-item"><span className="profile-info-label">Email</span><span className="profile-info-value">{basicInfo.email}</span></div>}
            {basicInfo.phone && <div className="profile-info-item"><span className="profile-info-label">Phone</span><span className="profile-info-value">{basicInfo.phone}</span></div>}
            {basicInfo.location && <div className="profile-info-item"><span className="profile-info-label">Location</span><span className="profile-info-value">{basicInfo.location}</span></div>}
          </div>
        </div>
      )}

      {/* Skills */}
      <div className="profile-section">
        <div className="profile-section-title">🛠 Technical Skills ({skills.length})</div>
        {skills.length > 0 ? (
          Object.entries(byCategory).map(([cat, catSkills]) => (
            <div key={cat} className="category-group">
              <div className="category-label">{categoryLabels[cat] || cat}</div>
              <div className="gap-badges">
                {catSkills.map((s) => <SkillBadge key={s.canonicalName} name={s.canonicalName} variant="neutral" />)}
              </div>
            </div>
          ))
        ) : (
          <span className="profile-no-data">No skills identified from this resume.</span>
        )}
      </div>

      {/* Projects */}
      {projects.length > 0 && (
        <div className="profile-section">
          <div className="profile-section-title">📂 Projects ({projects.length})</div>
          {projects.map((proj, i) => (
            <div key={i} className="profile-project">
              <div className="profile-project-title">{proj.title}</div>
              {proj.description && <div className="profile-project-desc">{proj.description.slice(0, 150)}{proj.description.length > 150 ? '…' : ''}</div>}
              {proj.technologies?.length > 0 && (
                <div className="profile-project-techs">
                  {proj.technologies.map((t) => <SkillBadge key={t} name={t} variant="additional" />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {education.length > 0 && (
        <div className="profile-section">
          <div className="profile-section-title">🎓 Education</div>
          {education.map((edu, i) => (
            <div key={i} className="profile-edu-item">
              <div className="profile-edu-degree">{edu.degree || 'Degree not specified'}</div>
              <div className="profile-edu-detail">
                {[edu.institution, edu.fieldOfStudy, edu.graduationYear].filter(Boolean).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <div className="profile-section">
          <div className="profile-section-title">💼 Experience</div>
          {experience.map((exp, i) => (
            <div key={i} className="profile-exp-item">
              <div className="profile-exp-title">{exp.jobTitle || 'Role not specified'}</div>
              {exp.organization && <div className="profile-exp-org">{exp.organization}</div>}
              {exp.duration && <div className="profile-exp-dur">{exp.duration}</div>}
              {exp.technologies?.length > 0 && (
                <div className="gap-badges" style={{ marginTop: '6px' }}>
                  {exp.technologies.map((t) => <SkillBadge key={t} name={t} variant="additional" />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <div className="profile-section">
          <div className="profile-section-title">🏅 Certifications</div>
          {certifications.map((cert, i) => (
            <div key={i} className="profile-cert-item">
              {cert.name}
              {cert.issuingOrganization && ` — ${cert.issuingOrganization}`}
              {cert.date && ` (${cert.date})`}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * JobRequirementsCard — displays JD analysis results.
 */
export const JobRequirementsCard = ({ parsedData, targetRole }) => {
  if (!parsedData) return <div className="profile-no-data">Job description not yet analyzed.</div>

  const {
    jobTitle, company, location, experienceRequirement,
    requiredSkills = [], preferredSkills = [],
    responsibilities = [], softSkills = [],
  } = parsedData

  return (
    <div className="jd-card">
      {/* Meta info */}
      {(jobTitle || company || location || experienceRequirement) && (
        <div className="jd-section">
          <div className="jd-section-title">📋 Job Information</div>
          <div className="jd-meta">
            {jobTitle && <div className="jd-meta-item"><span className="jd-meta-label">Title</span>{jobTitle}</div>}
            {company && <div className="jd-meta-item"><span className="jd-meta-label">Company</span>{company}</div>}
            {location && <div className="jd-meta-item"><span className="jd-meta-label">Location</span>{location}</div>}
            {experienceRequirement && <div className="jd-meta-item"><span className="jd-meta-label">Experience</span>{experienceRequirement}</div>}
          </div>
        </div>
      )}

      {/* Required Skills */}
      <div className="jd-section">
        <div className="jd-section-title">Required Skills ({requiredSkills.length})</div>
        <div className="gap-badges">
          {requiredSkills.length > 0
            ? requiredSkills.map((s) => <SkillBadge key={s.canonicalName} name={s.canonicalName} variant="matched" />)
            : <span className="gap-empty">No required skills identified</span>
          }
        </div>
      </div>

      {/* Preferred Skills */}
      {preferredSkills.length > 0 && (
        <div className="jd-section">
          <div className="jd-section-title">Preferred Skills ({preferredSkills.length})</div>
          <div className="gap-badges">
            {preferredSkills.map((s) => <SkillBadge key={s.canonicalName} name={s.canonicalName} variant="preferred" />)}
          </div>
        </div>
      )}

      {/* Responsibilities */}
      {responsibilities.length > 0 && (
        <div className="jd-section">
          <div className="jd-section-title">Key Responsibilities</div>
          {responsibilities.slice(0, 8).map((r, i) => (
            <div key={i} className="jd-responsibility">{r}</div>
          ))}
        </div>
      )}

      {/* Soft Skills */}
      {softSkills.length > 0 && (
        <div className="jd-section">
          <div className="jd-section-title">Soft Skills</div>
          <div>{softSkills.map((s, i) => <span key={i} className="jd-soft-skill">{s}</span>)}</div>
        </div>
      )}
    </div>
  )
}
