import { useRef, memo } from 'react'
import {
  Send, Trash2, Loader2, SkipForward,
  MicOff, AlertCircle, CheckCircle2
} from 'lucide-react'
import './AnswerComposer.css'

/**
 * Enterprise Answer Workspace & Dedicated Action Bar
 *
 * 1. Answer Card:
 *    - Header: YOUR ANSWER & Listening indicator
 *    - Unobtrusive live transcription row
 *    - Large, comfortable writing area
 *    - Bottom metadata row: word & character count, shortcut hint, clear button
 *
 * 2. Dedicated Action Bar (Below Answer Card in normal document flow):
 *    - Left: Skip Question (secondary)
 *    - Right: Submit Answer (primary, 46-48px)
 */
function AnswerComposer({
  answer = '',
  onAnswerChange,
  isListening = false,
  interimTranscript = '',
  speechStatus,
  speechError,
  isSpeechSupported = true,
  onSubmit,
  onSkip,
  onClear,
  submitting = false,
  skipping = false,
  mediaSubmitting = false,
  disabled = false,
  hasAudioAttached = false,
  hasVideoAttached = false,
}) {
  const textareaRef = useRef(null)

  const trimmed = answer.trim()
  const words = trimmed ? trimmed.split(/\s+/).length : 0
  const characters = answer.length

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (trimmed && !submitting && !skipping && !disabled) {
        onSubmit()
      }
    }
  }

  // Derive candidate-friendly status
  let statusIcon = null
  let statusText = 'Type or speak your answer'
  let statusTone = 'tone-idle'

  if (submitting) {
    statusIcon = <Loader2 size={12} className="spin-icon" />
    statusText = 'Evaluating response…'
    statusTone = 'tone-processing'
  } else if (mediaSubmitting) {
    statusIcon = <Loader2 size={12} className="spin-icon" />
    statusText = 'Analyzing response…'
    statusTone = 'tone-processing'
  } else if (isListening) {
    statusIcon = <span className="status-live-dot" />
    statusText = 'Listening automatically'
    statusTone = 'tone-live'
  } else if (speechStatus === 'processing') {
    statusIcon = <Loader2 size={12} className="spin-icon" />
    statusText = 'Converting response to text…'
    statusTone = 'tone-processing'
  } else if (hasAudioAttached || hasVideoAttached) {
    statusIcon = <CheckCircle2 size={12} className="status-check-icon" />
    statusText = 'Recording captured'
    statusTone = 'tone-success'
  } else if (speechError) {
    statusIcon = <AlertCircle size={12} className="status-warn-icon" />
    statusText = 'Type your answer manually'
    statusTone = 'tone-warn'
  } else if (!isSpeechSupported) {
    statusIcon = <MicOff size={12} />
    statusText = 'Speech unavailable · Type your answer'
    statusTone = 'tone-idle'
  }

  return (
    <div className="answer-workspace-block">
      {/* ── 1. The Answer Card ────────────────────────────────────────── */}
      <div className="enterprise-answer-card glass-card animate-fade-in">
        {/* Header: Section title & listening status */}
        <div className="answer-card-header">
          <span className="answer-card-label">YOUR ANSWER</span>

          <div className={`answer-status-pill ${statusTone}`} aria-live="polite">
            {statusIcon}
            <span>{statusText}</span>
          </div>
        </div>

        {/* Subtle inline transcription ribbon */}
        {isListening && interimTranscript && (
          <div className="answer-interim-ribbon animate-fade-in" aria-live="polite">
            <span className="interim-label">Transcribing:</span>
            <span className="interim-text">"{interimTranscript}"</span>
          </div>
        )}

        {/* Large comfortable writing area */}
        <div className="answer-textarea-box">
          <textarea
            ref={textareaRef}
            className="enterprise-answer-textarea"
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting || skipping || disabled}
            placeholder="Your spoken answer appears here automatically. You can also type, edit, or format your response directly..."
            aria-label="Interview answer response"
            rows={8}
          />
        </div>

        {/* Bottom statistics row (safely below text, never overlapping) */}
        <div className="answer-card-bottom-row">
          <div className="bottom-row-left">
            <span className="shortcut-text">
              Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit
            </span>
            {trimmed.length > 0 && onClear && (
              <button
                type="button"
                className="btn-clear-answer"
                onClick={onClear}
                disabled={submitting || skipping || disabled}
                title="Clear current text"
                aria-label="Clear current answer text"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="bottom-row-right">
            {(hasAudioAttached || hasVideoAttached) && (
              <span className="media-attached-tag">
                ✓ Media attached
              </span>
            )}
            <span className="word-char-stats">
              {words} {words === 1 ? 'word' : 'words'} · {characters} characters
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Dedicated Action Bar (Below Answer Card in document flow) ── */}
      <div className="answer-action-bar-row">
        <div className="action-bar-left">
          {onSkip && (
            <button
              type="button"
              className="btn-skip-action"
              onClick={onSkip}
              disabled={submitting || skipping || disabled}
              title="Skip this question"
              id="skip-question-btn"
            >
              {skipping ? (
                <>
                  <Loader2 size={14} className="spin-icon" />
                  <span>Skipping…</span>
                </>
              ) : (
                <>
                  <SkipForward size={14} />
                  <span>Skip Question</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="action-bar-right">
          <button
            type="button"
            className="btn-submit-action"
            onClick={onSubmit}
            disabled={!trimmed || submitting || skipping || disabled}
            id="submit-answer-btn"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin-icon" />
                <span>Evaluating…</span>
              </>
            ) : (
              <>
                <span>Submit Answer</span>
                <Send size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(AnswerComposer)
