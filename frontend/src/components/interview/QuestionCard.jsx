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
 * Designed around strong information hierarchy:
 * 1. Clean metadata row: "Question X of Y · Medium · Skill · Topic"
 * 2. Visual focal point: High-contrast, large question prompt (28-34px)
 * 3. Contextual row: Gentle inline note (e.g. skill gap rationale) without alert styling
 * 4. Subtle attribution footnote
 */
function QuestionCard({
  question,
  questionNumber = 1,
  totalQuestions = 10,
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
      {/* ── 1. Clean Metadata Row (No excessive badge clutter) ─────────── */}
      <div className="question-meta-row">
        <span className="question-counter">
          Question {questionNumber} of {totalQuestions}
        </span>
        <span className="meta-separator">·</span>
        <span className={`question-difficulty ${diffInfo.class}`}>
          {diffInfo.label}
        </span>
        <span className="meta-separator">·</span>
        <span className="question-topic" title={`Topic: ${topic}`}>
          {topic}
        </span>
        {isSkillGap && (
          <>
            <span className="meta-separator">·</span>
            <span className="question-source-tag">Skill Gap</span>
          </>
        )}
      </div>

      {/* ── 2. Primary Focal Point: The Question ────────────────────────── */}
      <h1 className="enterprise-question-text">
        {question.text}
      </h1>

      {/* ── 3. Subtle Contextual Information (Non-destructive, not an error alert) */}
      {question.contextNote && (
        <div className="question-contextual-info">
          <Info size={14} className="contextual-info-icon" />
          <span className="contextual-info-text">{question.contextNote}</span>
        </div>
      )}

      {/* ── 4. Subtle Attribution (Targeted reasoning) ──────────────────── */}
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
    </article>
  )
}

export default memo(QuestionCard)
