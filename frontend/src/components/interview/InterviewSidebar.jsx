import { memo } from 'react'
import {
  Sparkles, CheckCircle2, Loader2,
  Video, Mic, Compass
} from 'lucide-react'
import './InterviewSidebar.css'

/**
 * Enterprise Right Sidebar
 *
 * 1. Live Evaluation: Real-time assessment score, feedback snippet, key strengths
 * 2. Session Status: Camera analysis, Voice transcription, Adaptive sequencing
 * 3. Guidelines: Practical interview best practices and shortcuts
 */
function InterviewSidebar({
  lastEval = null,
  submitting = false,
  videoEnabled = true,
  isMicActive = true,
  isListening = false,
  speechStatus = null,
  isSpeechSupported = true,
  targetSkill = null,
}) {
  const currentScore = lastEval?.textEvaluation?.textScore ?? lastEval?.evaluation?.score
  const feedbackSnippet =
    lastEval?.textEvaluation?.feedback ||
    lastEval?.evaluation?.feedback ||
    lastEval?.textEvaluation?.improvementSuggestion

  // Derive voice transcription status text and dot style
  let voiceStatusText = 'Ready'
  let voiceDotClass = 'dot-green'
  let voiceValClass = 'val-active'

  if (!isSpeechSupported) {
    voiceStatusText = 'Unavailable'
    voiceDotClass = 'dot-muted'
    voiceValClass = 'val-muted'
  } else if (speechStatus === 'error') {
    voiceStatusText = 'Error'
    voiceDotClass = 'dot-amber'
    voiceValClass = 'val-warn'
  } else if (!isMicActive) {
    voiceStatusText = 'Muted'
    voiceDotClass = 'dot-amber'
    voiceValClass = 'val-muted'
  } else if (isListening) {
    voiceStatusText = 'Listening'
    voiceDotClass = 'dot-green dot-pulse'
    voiceValClass = 'val-active'
  }

  return (
    <aside className="enterprise-right-sidebar" aria-label="Live Evaluation and Session Monitoring">
      {/* ── CARD 1: LIVE EVALUATION ─────────────────────────────────── */}
      <div className="sidebar-card glass-card">
        <div className="sidebar-card-header">
          <span className="sidebar-card-title">Live Evaluation</span>
          <span className="badge-ai-indicator">
            <Sparkles size={11} />
            <span>AI</span>
          </span>
        </div>

        <div className="live-eval-body">
          {submitting ? (
            <div className="eval-submitting-state animate-fade-in">
              <Loader2 size={18} className="spin-icon" />
              <div className="submitting-text-block">
                <span className="submitting-title">Analyzing Response…</span>
                <span className="submitting-desc">Evaluating technical accuracy and depth</span>
              </div>
            </div>
          ) : lastEval ? (
            <div className="eval-result-state animate-fade-in">
              <div className="eval-score-row">
                <span className="eval-score-num">
                  {currentScore !== undefined ? currentScore : '—'}
                  <span className="eval-score-total">/100</span>
                </span>
                <span className="eval-status-pill">
                  <CheckCircle2 size={12} />
                  <span>Evaluated</span>
                </span>
              </div>

              {feedbackSnippet && (
                <p className="eval-feedback-snippet" title={feedbackSnippet}>
                  "{feedbackSnippet}"
                </p>
              )}

              {lastEval.textEvaluation?.strengths?.length > 0 && (
                <div className="eval-quick-tags">
                  <span className="quick-tags-label">Key Strengths:</span>
                  <div className="tags-flex">
                    {lastEval.textEvaluation.strengths.slice(0, 3).map((s, i) => (
                      <span key={i} className="eval-tag strength-tag">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="eval-awaiting-state">
              <div className="eval-empty-score">—<span className="eval-score-total">/100</span></div>
              <span className="eval-awaiting-title">Awaiting Response</span>
              <p className="eval-awaiting-desc">
                Your AI assessment metrics will update here in real time as you submit answers.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── CARD 2: SESSION STATUS ──────────────────────────────────── */}
      <div className="sidebar-card glass-card">
        <div className="sidebar-card-header">
          <span className="sidebar-card-title">Session Status</span>
          <span className="status-indicator-pill">Live</span>
        </div>

        <div className="session-status-list">
          <div className="status-item-row">
            <div className="status-row-left">
              <Video size={13} className="status-row-icon" />
              <span className="status-name">Camera analysis</span>
            </div>
            <span className={`status-val ${videoEnabled ? 'val-active' : 'val-muted'}`}>
              <span className={`status-dot ${videoEnabled ? 'dot-green' : 'dot-muted'}`} />
              {videoEnabled ? 'Active' : 'Off'}
            </span>
          </div>

          <div className="status-item-row">
            <div className="status-row-left">
              <Mic size={13} className="status-row-icon" />
              <span className="status-name">Voice transcription</span>
            </div>
            <span className={`status-val ${voiceValClass}`}>
              <span className={`status-dot ${voiceDotClass}`} />
              {voiceStatusText}
            </span>
          </div>

          <div className="status-item-row">
            <div className="status-row-left">
              <Compass size={13} className="status-row-icon" />
              <span className="status-name">Adaptive sequence</span>
            </div>
            <span className="status-val val-active">
              <span className="status-dot dot-green" />
              {targetSkill ? targetSkill : 'Active'}
            </span>
          </div>
        </div>
      </div>

      {/* ── CARD 3: GUIDELINES ──────────────────────────────────────── */}
      <div className="sidebar-card glass-card">
        <div className="sidebar-card-header">
          <span className="sidebar-card-title">Guidelines</span>
        </div>

        <ul className="sidebar-guidelines-list">
          <li>Keep camera eye-level for best visual posture analysis</li>
          <li>Speak naturally or type directly into the answer area</li>
          <li>Provide real-world architectural examples where possible</li>
          <li>Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit immediately</li>
        </ul>
      </div>
    </aside>
  )
}

export default memo(InterviewSidebar)
