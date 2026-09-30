import { useRef, memo } from 'react'
import {
  Send, Trash2, Loader2, SkipForward,
  MicOff, AlertCircle, CheckCircle2
} from 'lucide-react'
import './AnswerComposer.css'

/**
 * Enterprise AnswerComposer Workspace
 *
 * Integrated interview editor with:
 * - Clear section title & subtle listening/recording state row
 * - Unobtrusive inline transcription status
 * - Large, comfortable writing area without overlapping elements
 * - Word & character count row safely below the text
 * - Solid bottom action bar (Skip secondary, Submit Answer primary 44-48px)
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
    <div className="enterprise-answer-workspace glass-card animate-fade-in">
      {/* ── 1. Header: Section Label & Subtle Status Row ───────────────── */}
      <div className="workspace-header-row">
        <div className="workspace-title-label">YOUR ANSWER</div>

        <div className={`workspace-status-indicator ${statusTone}`} aria-live="polite">
          {statusIcon}
          <span>{statusText}</span>
        </div>
      </div>

      {/* ── 2. Subtle Inline Live Transcription (Non-intrusive) ────────── */}
      {isListening && interimTranscript && (
        <div className="workspace-interim-row animate-fade-in" aria-live="polite">
          <span className="interim-prefix">Transcribing:</span>
          <span className="interim-content">"{interimTranscript}"</span>
        </div>
      )}

      {/* ── 3. Large Comfortable Answer Area ──────────────────────────── */}
      <div className="workspace-textarea-wrapper">
        <textarea
          ref={textareaRef}
          className="enterprise-answer-textarea"
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={submitting || skipping || disabled}
          placeholder={
            isSpeechSupported && !speechError
              ? 'Your spoken answer appears here automatically. You can also type, edit, or format your response directly…'
              : 'Type your answer here… Structure your explanation clearly and include relevant technical examples.'
          }
          aria-label="Candidate response text"
          rows={7}
        />
      </div>

      {/* ── 4. Dedicated Metadata Row (Placed safely below typing area) ── */}
      <div className="workspace-meta-row">
        <div className="meta-left">
          <span className="shortcut-guide">
            Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit
          </span>
          {answer.trim().length > 0 && onClear && (
            <button
              type="button"
              className="btn-text-clear"
              onClick={onClear}
              disabled={submitting || skipping || disabled}
              title="Clear answer text"
              aria-label="Clear answer text"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          )}
        </div>

        <div className="meta-right">
          {(hasAudioAttached || hasVideoAttached) && (
            <span className="attached-media-tag">
              ✓ Media captured
            </span>
          )}
          <span className="text-count-stat">
            {words} {words === 1 ? 'word' : 'words'} · {characters} chars
          </span>
        </div>
      </div>

      {/* ── 5. Integrated Action Bar (Always visible & accessible) ─────── */}
      <div className="workspace-action-bar">
        <div className="action-bar-left">
          {onSkip && (
            <button
              type="button"
              className="btn-action-skip"
              onClick={onSkip}
              disabled={submitting || skipping || disabled}
              title="Skip this question"
              id="skip-question-btn"
            >
              {skipping ? (
                <>
                  <Loader2 size={15} className="spin-icon" />
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
            className="btn-action-submit"
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
