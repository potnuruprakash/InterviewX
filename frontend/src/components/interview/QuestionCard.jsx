import { memo } from 'react'
import { Sparkles, Target, Info, BookOpen, Zap, BarChart2, TrendingUp, CheckCircle } from 'lucide-react'
import './QuestionCard.css'

const DIFFICULTY_MAP = {
  easy: { label: 'Easy', class: 'diff-easy' },
  medium: { label: 'Medium', class: 'diff-medium' },
  hard: { label: 'Hard', class: 'diff-hard' },
}

/**
 * QuestionCard Component
 *
 * Focuses candidate attention on the primary question.
 * Displays:
 * - "Question X of Y"
 * - Difficulty Badge (Easy/Medium/Hard)
 * - Topic / Category
 * - Optional small "Adaptive" indicator
 * - Context note / source if applicable
 */
function QuestionCard({
  question,
  questionNumber = 1,
  totalQuestions = 10,
}) {
  if (!question) {
    return (
      <article className="cockpit-question-card glass-card">
        <div className="question-loading-state">
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-body" />
        </div>
      </article>
    )
  }

  const difficulty = (question.difficulty || 'medium').toLowerCase()
  const diffInfo = DIFFICULTY_MAP[difficulty] || DIFFICULTY_MAP.medium

  const topic = question.category || question.targetSkill || 'General Technical'
  const isAdaptive = question.source !== 'static_bank' && question.source !== 'preset'

  return (
    <article className="cockpit-question-card glass-card animate-fade-in" key={question.id}>
      {/* ── Question Meta Bar ────────────────────────────────────────── */}
      <div className="cockpit-question-meta">
        <div className="meta-left-group">
          <span className="question-index-badge">
            Question {questionNumber} of {totalQuestions}
          </span>

          {/* Difficulty Badge */}
          <span className={`cockpit-diff-badge ${diffInfo.class}`}>
            {diffInfo.label}
          </span>

          {/* Topic */}
          <span className="cockpit-topic-badge" title={`Topic: ${topic}`}>
            <span style={{ textTransform: 'capitalize' }}>
              {topic.replace(/_/g, ' ')}
            </span>
          </span>

          {/* Target Skill if different from topic */}
          {question.targetSkill && question.targetSkill !== 'general' && question.targetSkill !== topic && (
            <span className="cockpit-skill-badge">
              <Target size={11} />
              <span>{question.targetSkill}</span>
            </span>
          )}
        </div>

        {/* Small Adaptive Indicator */}
        {isAdaptive && (
          <div className="cockpit-adaptive-tag" title="Question dynamically selected by AI adaptive engine">
            <Sparkles size={11} className="adaptive-sparkle-icon" />
            <span>Adaptive</span>
          </div>
        )}
      </div>

      {/* ── Context Note if Available ─────────────────────────────────── */}
      {question.contextNote && (
        <div className="cockpit-context-note">
          <Info size={13} className="context-note-icon" />
          <span>{question.contextNote}</span>
        </div>
      )}

      {/* ── Main Question Prompt ──────────────────────────────────────── */}
      <h1 className="cockpit-question-prompt">
        {question.text}
      </h1>

      {/* ── Source Attribution (Resume / Job Description / Skill Gap) ─── */}
      {question.source && question.source !== 'static_bank' && (
        <div className="cockpit-source-attribution">
          {question.source === 'resume' && (
            <>
              <BookOpen size={12} />
              <span>Tailored to your resume experience</span>
            </>
          )}
          {question.source === 'job_description' && (
            <>
              <Zap size={12} />
              <span>Targeted for job description requirements</span>
            </>
          )}
          {question.source === 'skill_gap' && (
            <>
              <BarChart2 size={12} />
              <span>Focused skill gap assessment</span>
            </>
          )}
          {question.source === 'experience' && (
            <>
              <TrendingUp size={12} />
              <span>Project & engineering experience</span>
            </>
          )}
          {question.source === 'behavioral' && (
            <>
              <CheckCircle size={12} />
              <span>Behavioral competency evaluation</span>
            </>
          )}
        </div>
      )}
    </article>
  )
}

export default memo(QuestionCard)
