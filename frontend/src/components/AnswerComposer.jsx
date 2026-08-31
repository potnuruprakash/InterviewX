import { useRef } from 'react'
import {
  Mic, Video, Type, Send, Trash2, Square,
  CheckCircle, AlertCircle, Loader2, Sparkles, SkipForward
} from 'lucide-react'
import './AnswerComposer.css'

export default function AnswerComposer({
  answer,
  onAnswerChange,
  mode = 'text',
  onModeChange,
  isListening,
  interimTranscript,
  speechStatus,
  speechError,
  isSpeechSupported,
  onStartSpeaking,
  onStopSpeaking,
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

  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0
  const characters = answer.length

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (answer.trim() && !submitting && !disabled) {
        onSubmit()
      }
    }
  }

  // Determine speech status text and style
  let statusText = 'Microphone off'
  let statusIcon = null
  let statusBadgeClass = 'status-idle'

  if (speechStatus === 'unsupported' || !isSpeechSupported) {
    statusText = "Speech-to-text isn't available in this browser. You can type your answer."
    statusBadgeClass = 'status-warning'
  } else if (speechError) {
    statusText = speechError
    statusBadgeClass = 'status-error'
  } else if (isListening) {
    statusText = 'Listening...'
    statusBadgeClass = 'status-listening'
  } else if (speechStatus === 'processing') {
    statusText = 'Transcribing...'
    statusBadgeClass = 'status-processing'
  } else if (speechStatus === 'ready' || (answer.trim() && (mode === 'audio' || mode === 'video'))) {
    statusText = 'Transcript ready'
    statusBadgeClass = 'status-ready'
  }

  return (
    <div className="answer-composer glass-card animate-fade-in">
      {/* Header with Mode Switcher */}
      <div className="composer-header">
        <div className="composer-title-group">
          <span className="composer-title">Your Answer</span>
          <span className="composer-subtitle">Speak or type your structured response</span>
        </div>

        <div className="composer-modes" role="tablist" aria-label="Input mode selector">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'audio'}
            className={`mode-btn ${mode === 'audio' ? 'active' : ''}`}
            onClick={() => onModeChange('audio')}
            disabled={submitting || disabled}
            title="Answer with voice transcription"
          >
            <Mic size={15} />
            <span>Voice</span>
            {hasAudioAttached && <span className="media-attached-dot" title="Voice audio attached" />}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'video'}
            className={`mode-btn ${mode === 'video' ? 'active' : ''}`}
            onClick={() => onModeChange('video')}
            disabled={submitting || disabled}
            title="Answer with video interview & voice transcription"
          >
            <Video size={15} />
            <span>Video</span>
            {hasVideoAttached && <span className="media-attached-dot" title="Video recording attached" />}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'text'}
            className={`mode-btn ${mode === 'text' ? 'active' : ''}`}
            onClick={() => onModeChange('text')}
            disabled={submitting || disabled}
            title="Type answer manually"
          >
            <Type size={15} />
            <span>Text</span>
          </button>
        </div>
      </div>

      {/* Speech Status & Primary Dictation Controls (when voice or video mode active) */}
      {(mode === 'audio' || mode === 'video') && (
        <div className="speech-control-bar">
          <div className={`speech-status-indicator ${statusBadgeClass}`}>
            {isListening ? (
              <span className="listening-pulse">
                <span className="pulse-wave" />
                <Mic size={14} className="mic-active-icon" />
              </span>
            ) : speechError ? (
              <AlertCircle size={14} />
            ) : speechStatus === 'processing' ? (
              <Loader2 size={14} className="spin" />
            ) : speechStatus === 'ready' || answer.trim() ? (
              <CheckCircle size={14} />
            ) : (
              <Mic size={14} />
            )}
            <span className="speech-status-text">{statusText}</span>
          </div>

          <div className="speech-actions">
            {!isListening ? (
              <button
                type="button"
                className="btn btn-voice-start"
                onClick={onStartSpeaking}
                disabled={submitting || disabled || !isSpeechSupported}
                title="Start speaking your answer"
                id="start-speaking-btn"
              >
                <Mic size={15} />
                <span>Start speaking</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-voice-stop"
                onClick={onStopSpeaking}
                title="Stop speaking"
                id="stop-speaking-btn"
              >
                <Square size={13} fill="currentColor" />
                <span>Stop speaking</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Live Interim Transcript Ribbon (shows current phrase in-flight) */}
      {isListening && interimTranscript && (
        <div className="live-interim-box">
          <Sparkles size={13} className="sparkle-icon" />
          <span className="interim-label">Transcribing:</span>
          <span className="interim-text">"{interimTranscript}"</span>
        </div>
      )}

      {/* Answer Textarea */}
      <div className="textarea-container">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={submitting || disabled}
          rows={9}
          placeholder={
            mode === 'audio' || mode === 'video'
              ? 'Your spoken answer will appear here automatically. You can also edit, correct, or add to the text at any time...'
              : 'Type your answer here... Be specific, provide technical examples, and structure your explanation clearly.'
          }
          aria-label="Interview answer text"
        />

        {/* Floating character & word counter */}
        <div className="textarea-meta">
          <span className="meta-item">{words} {words === 1 ? 'word' : 'words'}</span>
          <span className="meta-separator">·</span>
          <span className="meta-item">{characters} chars</span>
        </div>
      </div>

      {/* Composer Footer Actions */}
      <div className="composer-footer">
        <div className="footer-left">
          {answer.trim().length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-clear"
              onClick={onClear}
              disabled={submitting || disabled || isListening}
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
              id="skip-question-btn"
            >
              {skipping ? (
                <>
                  <Loader2 size={15} className="spin" />
                  <span>Skipping...</span>
                </>
              ) : (
                <>
                  <SkipForward size={15} />
                  <span>Skip Question</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-submit-answer"
            onClick={onSubmit}
            disabled={!answer.trim() || submitting || skipping || disabled}
            id="submit-answer-btn"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>Evaluating answer...</span>
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
