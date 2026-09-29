import { memo } from 'react'
import { Brain, Camera, Mic, LogOut } from 'lucide-react'
import InterviewTimer from './InterviewTimer'
import './InterviewHeader.css'

/**
 * Top Bar for Interview Cockpit
 *
 * Left: Logo, Target Role, Interview Type
 * Center: "Interview in progress"
 * Right: Isolated Countdown Timer, Device Status (Camera, Mic), End Session
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
}) {
  const formattedType = interviewType
    ? interviewType.toLowerCase().includes('interview')
      ? interviewType
      : `${interviewType.charAt(0).toUpperCase() + interviewType.slice(1)} Interview`
    : 'Technical Interview'

  return (
    <header className="interview-cockpit-topbar">
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
            <Brain size={22} className="brand-logo-icon" />
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

        {/* ── Center: Interview in progress ───────────────────────────── */}
        <div className="topbar-section-center">
          <div className="interview-status-indicator">
            <span className="live-status-pulse" />
            <span className="live-status-label">Interview in progress</span>
          </div>
        </div>

        {/* ── Right: Timer + Device Status + End Interview ────────────── */}
        <div className="topbar-section-right">
          {/* Isolated Countdown Timer */}
          <InterviewTimer
            startedAt={startedAt}
            durationMinutes={durationMinutes}
            onExpire={onTimerExpire}
            isComplete={isComplete}
          />

          {/* Device Status Indicators */}
          <div className="device-status-indicators">
            <div
              className={`device-pip ${videoEnabled ? 'device-on' : 'device-off'}`}
              title={videoEnabled ? 'Camera is active' : 'Camera is disabled'}
            >
              <span className="device-dot" />
              <Camera size={13} />
              <span className="device-label">Camera</span>
            </div>

            <div
              className={`device-pip ${isMicActive ? 'device-on' : 'device-off'}`}
              title={isMicActive ? 'Microphone is active' : 'Microphone is muted'}
            >
              <span className="device-dot" />
              <Mic size={13} />
              <span className="device-label">Mic</span>
            </div>
          </div>

          {/* Exit / End Session */}
          <button
            type="button"
            className="btn-cockpit-end"
            onClick={onEndInterview}
            title="End interview session and view evaluation"
            aria-label="End interview session"
          >
            <LogOut size={14} />
            <span>End Session</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default memo(InterviewHeader)
