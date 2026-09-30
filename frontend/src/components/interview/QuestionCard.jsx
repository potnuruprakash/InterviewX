import { memo } from 'react'
import { Info, BookOpen, Zap, BarChart2, TrendingUp, CheckCircle2 } from 'lucide-react'
import './QuestionCard.css'

const DIFFICULTY_MAP = {
  easy: { label: 'Easy', class: 'diff-easy' },
  medium: { label: 'Medium', class: 'diff-medium' },
  hard: { label: 'Hard', class: 'diff-hard' },
}

/**
 * QuestionCard Component
 *
 * Dedicated Question Workspace Card with:
 * - Badges row: Question X of Y, Difficulty, Skill Gap, Topic
 * - Large dominant question prompt
 * - Resume/Context information
 * - Assessment type attribution
 * - Upper-right slot for Floating Video Window with protected padding
 */
function QuestionCard({
  question,
  questionNumber = 1,
  totalQuestions = 10,
  floatingVideo = null,
}) {
  if (!question) {
    return (
      <article className="enterprise-question-card glass-card">
        <div className="question-skeleton-state">
          <div className="skeleton-bar skeleton-meta" />
          <div className="skeleton-bar skeleton-title-1" />
          <div className="skeleton-bar skeleton-title-2" />
        </div>
      </article>
    )
  }

  const difficulty = (question.difficulty || 'medium').toLowerCase()
  const diffInfo = DIFFICULTY_MAP[difficulty] || DIFFICULTY_MAP.medium

  const rawTopic = question.category || question.targetSkill || 'General Technical'
  const topic = rawTopic.replace(/_/g, ' ')
  const isSkillGap = question.source === 'skill_gap'

  return (
    <article className="enterprise-question-card glass-card animate-fade-in" key={question.id}>
      {/* ── Question Text Content Flow (has protected right-side spacing) ─ */}
      <div className="question-content-flow">
        {/* Badges Row */}
        <div className="question-badges-row">
          <span className="q-badge q-counter">
            Question {questionNumber} of {totalQuestions}
          </span>
          <span className={`q-badge q-diff ${diffInfo.class}`}>
            {diffInfo.label}
          </span>
          {isSkillGap && (
            <span className="q-badge q-skill-gap">Skill Gap</span>
          )}
          <span className="q-badge q-topic" title={`Topic: ${topic}`}>
            {topic}
          </span>
        </div>

        {/* Primary Dominant Question Title */}
        <h1 className="enterprise-question-text">
          {question.text}
        </h1>

        {/* Context / Resume Rationale Note */}
        {question.contextNote && (
          <div className="question-contextual-info">
            <Info size={14} className="contextual-info-icon" />
            <span className="contextual-info-text">{question.contextNote}</span>
          </div>
        )}

        {/* Assessment Type Attribution */}
        {question.source && question.source !== 'static_bank' && (
          <div className="question-attribution-footnote">
            {question.source === 'resume' && (
              <>
                <BookOpen size={12} className="attr-icon" />
                <span>Tailored to your resume experience</span>
              </>
            )}
            {question.source === 'job_description' && (
              <>
                <Zap size={12} className="attr-icon" />
                <span>Targeted for job requirements</span>
              </>
            )}
            {question.source === 'skill_gap' && (
              <>
                <BarChart2 size={12} className="attr-icon" />
                <span>Focused skill-gap assessment</span>
              </>
            )}
            {question.source === 'experience' && (
              <>
                <TrendingUp size={12} className="attr-icon" />
                <span>Engineering & architecture experience</span>
              </>
            )}
            {question.source === 'behavioral' && (
              <>
                <CheckCircle2 size={12} className="attr-icon" />
                <span>Behavioral & communication evaluation</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Upper-Right Floating Video Window Anchor ───────────────────── */}
      {floatingVideo && (
        <div className="question-floating-video-anchor">
          {floatingVideo}
        </div>
      )}
    </article>
  )
}

export default memo(QuestionCard)
