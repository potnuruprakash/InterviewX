import { memo } from 'react'
import { Brain, Camera, CameraOff, Mic, MicOff, LogOut } from 'lucide-react'
import InterviewTimer from './InterviewTimer'
import './InterviewHeader.css'

/**
 * Enterprise Header for InterviewX Workspace
 *
 * Fixed 60px height.
 * Strict non-wrapping flex layout.
 * Clean information hierarchy:
 * - Left: Logo, role, interview type
 * - Center: Question progress (Question X of Total)
 * - Right: Countdown timer, compact device indicators, segregated End Session
 */
function InterviewHeader({
  targetRole = 'Software Engineer',
  interviewType = 'Technical Interview',
  startedAt,
  durationMinutes = 30,
  onTimerExpire,
  isComplete = false,
  videoEnabled = true,
  isMicActive = true,
  onEndInterview,
  onBrandClick,
  questionNumber,
  totalQuestions,
}) {
  const formattedType = interviewType
    ? interviewType.toLowerCase().includes('interview')
      ? interviewType
      : `${interviewType.charAt(0).toUpperCase() + interviewType.slice(1)} Interview`
    : 'Technical Interview'

  return (
    <header className="interview-topbar" role="banner">
      <div className="topbar-inner-container">
        {/* ── Left: Logo + Role + Interview Type ──────────────────────── */}
        <div className="topbar-section-left">
          <div
            className="topbar-brand"
            onClick={onBrandClick}
            role="button"
            tabIndex={0}
            title="InterviewX Dashboard"
            aria-label="InterviewX Dashboard"
          >
            <div className="topbar-logo-wrap">
              <Brain size={18} className="brand-logo-icon" />
            </div>
            <span className="brand-title">InterviewX</span>
          </div>

          <div className="topbar-divider" />

          <div className="topbar-role-context">
            <span className="topbar-target-role" title={targetRole}>
              {targetRole}
            </span>
            <span className="topbar-interview-type">
              {formattedType}
            </span>
          </div>
        </div>

        {/* ── Center: Clean Question Progress ─────────────────────────── */}
        <div className="topbar-section-center">
          {questionNumber != null && totalQuestions != null && (
            <div
              className="topbar-question-indicator"
              aria-label={`Question ${questionNumber} of ${totalQuestions}`}
            >
              <span className="question-step-text">
                Question <strong>{questionNumber}</strong> of {totalQuestions}
              </span>
            </div>
          )}
        </div>

        {/* ── Right: Timer + Compact Devices + End Session ────────────── */}
        <div className="topbar-section-right">
          {/* Isolated Non-Jittering Countdown Timer */}
          <InterviewTimer
            startedAt={startedAt}
            durationMinutes={durationMinutes}
            onExpire={onTimerExpire}
            isComplete={isComplete}
          />

          {/* Compact Device Status Cluster */}
          <div className="topbar-device-cluster" aria-label="Audio and Video hardware status">
            <div
              className={`device-indicator-icon ${videoEnabled ? 'is-on' : 'is-off'}`}
              title={videoEnabled ? 'Camera is active' : 'Camera is off'}
              aria-label={videoEnabled ? 'Camera active' : 'Camera disabled'}
            >
              {videoEnabled ? <Camera size={15} /> : <CameraOff size={15} />}
              <span className={`device-status-dot ${videoEnabled ? 'dot-active' : 'dot-off'}`} />
            </div>

            <div
              className={`device-indicator-icon ${isMicActive ? 'is-on' : 'is-off'}`}
              title={isMicActive ? 'Microphone is active' : 'Microphone is muted'}
              aria-label={isMicActive ? 'Microphone active' : 'Microphone muted'}
            >
              {isMicActive ? <Mic size={15} /> : <MicOff size={15} />}
              <span className={`device-status-dot ${isMicActive ? 'dot-active' : 'dot-off'}`} />
            </div>
          </div>

          <div className="topbar-divider-end" />

          {/* Destructive Action: End Session */}
          <button
            type="button"
            className="btn-topbar-end"
            onClick={onEndInterview}
            title="End interview session"
            aria-label="End interview session"
          >
            <LogOut size={14} />
            <span className="end-session-label">End Session</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default memo(InterviewHeader)
