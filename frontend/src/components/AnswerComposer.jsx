import { useRef } from 'react'
import {
  Send, Trash2, Loader2, Sparkles, SkipForward,
  Mic, MicOff, AlertCircle, CheckCircle
} from 'lucide-react'
import { normalizeTranscriptJoin } from '../hooks/useSpeechRecognition'
import './AnswerComposer.css'

/**
 * AnswerComposer — Automatic Voice & Text Input
 *
 * - Automatically populates candidate's spoken words into the textarea in real time.
 * - Displays speech dynamically with live transcription sync.
 * - Interactive mic status badge allowing pause/resume of dictation.
 * - Candidate can freely edit, format, or type their answer alongside voice.
 */
export default function AnswerComposer({
  answer,
  onAnswerChange,
  isListening,
  interimTranscript,
  speechStatus,
  speechError,
  isSpeechSupported,
  onStartListening,
  onStopListening,
  onClearInterim,
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

  // Real-time composite text that immediately reflects live voice input in the text area
  const activeText = interimTranscript
    ? normalizeTranscriptJoin(answer, interimTranscript)
    : answer

  const words = activeText.trim() ? activeText.trim().split(/\s+/).length : 0
  const characters = activeText.length

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (activeText.trim() && !submitting && !disabled) {
        onSubmit()
      }
    }
  }

  const handleTextareaChange = (e) => {
    // If the candidate manually types while interim text is active,
    // clear the interim buffer so manual edits are not overwritten
    if (interimTranscript && onClearInterim) {
      onClearInterim()
    }
    onAnswerChange(e.target.value)
  }

  // Determine speech status for indicator
  let micStatusClass = 'mic-status-idle'
  let micStatusText = 'Click to speak'
  let MicIcon = Mic

  if (!isSpeechSupported) {
    micStatusClass = 'mic-status-warn'
    micStatusText = 'Speech not supported — type your answer'
    MicIcon = MicOff
  } else if (speechError) {
    micStatusClass = 'mic-status-error'
    micStatusText = 'Mic unavailable — type your answer'
    MicIcon = MicOff
  } else if (isListening || speechStatus === 'restarting') {
    micStatusClass = 'mic-status-active'
    micStatusText = 'Listening... (Click to stop)'
    MicIcon = Mic
  } else if (speechStatus === 'processing') {
    micStatusClass = 'mic-status-processing'
    micStatusText = 'Transcribing...'
    MicIcon = Mic
  } else if (speechStatus === 'ready' || activeText.trim()) {
    micStatusClass = 'mic-status-ready'
    micStatusText = 'Click to speak'
    MicIcon = Mic
  }

  const handleToggleMic = () => {
    if (disabled || !isSpeechSupported) return
    if (isListening) {
      onStopListening?.()
    } else {
      onStartListening?.()
    }
  }

  return (
    <div className="answer-composer glass-card animate-fade-in">
      {/* Header */}
      <div className="composer-header">
        <div className="composer-title-group">
          <span className="composer-title">Your Answer</span>
          <span className="composer-subtitle">Click the microphone to speak, or type directly into the field</span>
        </div>

        {/* Interactive mic status indicator */}
        <button
          type="button"
          className={`mic-status-pill ${micStatusClass} ${isSpeechSupported ? 'clickable' : ''}`}
          onClick={handleToggleMic}
          title={
            isListening
              ? 'Click to stop microphone dictation'
              : isSpeechSupported
              ? 'Click to activate microphone dictation'
              : speechError || 'Speech recognition unavailable'
          }
          disabled={disabled || !isSpeechSupported}
        >
          {isListening ? (
            <span className="mic-pulse-wrapper">
              <span className="mic-pulse-ring" />
              <Mic size={12} className="mic-icon-active" />
            </span>
          ) : (
            <MicIcon size={12} />
          )}
          <span>{micStatusText}</span>
        </button>
      </div>

      {/* Live Interim Transcript Ribbon */}
      {isListening && interimTranscript && (
        <div className="live-interim-box animate-fade-in">
          <Sparkles size={13} className="sparkle-icon" />
          <span className="interim-label">Transcribing:</span>
          <span className="interim-text">"{interimTranscript}"</span>
        </div>
      )}

      {/* Speech error notice */}
      {speechError && (
        <div className="speech-error-notice animate-fade-in">
          <AlertCircle size={13} />
          <span>{speechError}</span>
        </div>
      )}

      {/* Answer Textarea */}
      <div className="textarea-container">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          value={activeText}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          disabled={submitting || disabled}
          rows={10}
          placeholder={
            isSpeechSupported && !speechError
              ? "Type your answer or click 'Click to speak' to use voice dictation. Words will appear automatically as you speak..."
              : 'Type your answer here... Be specific, provide technical examples, and structure your explanation clearly.'
          }
          aria-label="Interview answer text"
        />

        {/* Word & character counter */}
        <div className="textarea-meta">
          {(hasAudioAttached || hasVideoAttached) && (
            <span className="media-attached-badge">
              {hasVideoAttached ? '🎥' : '🎤'} Media attached
            </span>
          )}
          <span className="meta-item">{words} {words === 1 ? 'word' : 'words'}</span>
          <span className="meta-separator">·</span>
          <span className="meta-item">{characters} chars</span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="composer-footer">
        <div className="footer-left">
          {activeText.trim().length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-clear"
              onClick={onClear}
              disabled={submitting || disabled}
              title="Clear current answer text"
            >
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
          )}
          <span className="shortcut-hint">
            Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to submit
          </span>
        </div>

        <div className="footer-right">
          {mediaSubmitting && (
            <span className="media-sync-indicator">
              <Loader2 size={13} className="spin" />
              <span>Uploading media...</span>
            </span>
          )}

          {onSkip && (
            <button
              type="button"
              className="btn btn-secondary btn-skip-question"
              onClick={onSkip}
              disabled={submitting || skipping || disabled}
              title="Skip this question without submitting an answer"
              id="skip-question-composer-btn"
            >
              {skipping ? (
                <>
                  <Loader2 size={15} className="spin" />
                  <span>Skipping...</span>
                </>
              ) : (
                <>
                  <SkipForward size={15} />
                  <span>Skip</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-submit-answer"
            onClick={onSubmit}
            disabled={!activeText.trim() || submitting || skipping || disabled}
            id="submit-answer-btn"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>Evaluating...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Submit Answer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
